from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, create_model
from fastapi.templating import Jinja2Templates
import joblib
import pandas as pd
import shap
import os
import uvicorn
import warnings

warnings.filterwarnings('ignore')

app = FastAPI(title="Fraud Detection API with Explainable AI")

# Define Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
SRC_DIR = os.path.join(BASE_DIR, 'src')

# Serve static files but intercept root for our index.html
# We will use Jinja2 to serve index to allow absolute paths easily
# For simplicity, we'll just read the html file directly

# Load artifacts at startup
try:
    print("Loading models...")
    model = joblib.load(os.path.join(MODEL_DIR, 'trained_model.pkl'))
    feature_names = joblib.load(os.path.join(MODEL_DIR, 'features.joblib'))
    
    # Try loading explainer if it was pickled, otherwise initialize it directly
    explainer_path = os.path.join(MODEL_DIR, 'shap_explainer.pkl')
    if os.path.exists(explainer_path):
        explainer = joblib.load(explainer_path)
    else:
        # Recreate explainer if picking failed during pipeline
        explainer = shap.TreeExplainer(model, feature_perturbation="tree_path_dependent")
        
    print("Models loaded successfully.")
    
except Exception as e:
    print(f"Error loading models: {e}")
    # We allow the app to run so the frontend can display, but predict will fail
    model, explainer, feature_names = None, None, ["V1", "V2", "Amount", "Time"]

# Create a dynamic Pydantic Model based on the expected features
# All features in creditcard.csv are float
def create_transaction_model():
    if not feature_names:
        return None
    fields = {feat: (float, 0.0) for feat in feature_names}
    return create_model('TransactionData', **fields)

TransactionData = create_transaction_model()

# We need a fallback explicitly typed model if the above fails
class SimpleTransaction(BaseModel):
    data: dict

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    index_path = os.path.join(SRC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>UI Not Found</h1><p>Ensure index.html is in the src/ directory.</p>"

@app.get("/{filename}.css")
async def serve_css(filename: str):
    css_path = os.path.join(SRC_DIR, f"{filename}.css")
    if os.path.exists(css_path):
        from fastapi.responses import FileResponse
        return FileResponse(css_path, media_type="text/css")
    raise HTTPException(status_code=404)

@app.get("/{filename}.js")
async def serve_js(filename: str):
    js_path = os.path.join(SRC_DIR, f"{filename}.js")
    if os.path.exists(js_path):
        from fastapi.responses import FileResponse
        return FileResponse(js_path, media_type="application/javascript")
    raise HTTPException(status_code=404)

# Load dataset once for transaction generation
df_data = None
try:
    df_data = pd.read_csv(os.path.join(BASE_DIR, 'data', 'creditcard.csv'))
    df_legit = df_data[df_data['Class'] == 0]
    df_fraud = df_data[df_data['Class'] == 1]
except:
    pass

@app.get("/random_transaction")
async def get_random_transaction(type: str = "legit"):
    if df_data is None:
        raise HTTPException(status_code=500, detail="Dataset not found to sample from")
    
    if type == "fraud" and not df_fraud.empty:
        sample = df_fraud.sample(1).iloc[0].to_dict()
    else:
        sample = df_legit.sample(1).iloc[0].to_dict()
        
    # Remove class from sample so it matches inference input
    if "Class" in sample:
        del sample["Class"]
        
    return sample


@app.post("/predict")
async def predict_fraud(transaction: Request):
    if model is None or explainer is None:
        raise HTTPException(status_code=500, detail="Models are not loaded.")
        
    # Read the JSON payload dynamically to handle exact features
    data_dict = await transaction.json()
    
    # Ensure all required features are present
    formatted_data = {}
    for f in feature_names:
        formatted_data[f] = float(data_dict.get(f, 0.0))
        
    # Create DataFrame for prediction
    df = pd.DataFrame([formatted_data])
    
    try:
        # Make Prediction
        prediction = model.predict(df)[0]
        prediction_proba = model.predict_proba(df)[0][1] # Probability of fraud
        
        # Calculate SHAP Values
        shap_values_obj = explainer(df)
        shap_values = shap_values_obj.values[0]
        
        # We need to extract the feature importances to send to the frontend
        # Sort features by absolute SHAP value impact
        feature_importance = []
        for i, feat in enumerate(feature_names):
            sv = shap_values[i]
            # SHAP for RF binary classification returns an array [impact_class0, impact_class1]
            if hasattr(sv, '__iter__') and not isinstance(sv, str):
                sv = sv[-1]
            feature_importance.append({
                "feature": feat,
                "value": round(formatted_data[feat], 4),
                "shap_value": float(sv)
            })
            
        # Sort by absolute shape value descending
        feature_importance = sorted(feature_importance, key=lambda x: abs(x["shap_value"]), reverse=True)
        # return top 10 impactful features
        top_features = feature_importance[:10]
        
        return {
            "prediction": "Fraud" if prediction == 1 else "Legitimate",
            "fraud_probability": float(prediction_proba),
            "shap_explanation": top_features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_batch")
async def predict_fraud_batch(request: Request):
    if model is None or explainer is None:
        raise HTTPException(status_code=500, detail="Models are not loaded.")
        
    data_list = await request.json()
    if not isinstance(data_list, list):
        raise HTTPException(status_code=400, detail="Expected a JSON array of transactions.")
        
    formatted_data_list = []
    for data_dict in data_list:
        formatted_data = {}
        for f in feature_names:
            formatted_data[f] = float(data_dict.get(f, 0.0))
        formatted_data_list.append(formatted_data)
        
    df = pd.DataFrame(formatted_data_list)
    
    try:
        predictions = model.predict(df)
        prediction_probas = model.predict_proba(df)[:, 1]
        
        # Calculate SHAP values for all rows
        shap_values_obj = explainer(df)
        all_shap_values = shap_values_obj.values
        
        results = []
        for row_idx in range(len(formatted_data_list)):
            row_data = formatted_data_list[row_idx]
            shap_vals = all_shap_values[row_idx]
            
            feature_importance = []
            for i, feat in enumerate(feature_names):
                sv = shap_vals[i]
                if hasattr(sv, '__iter__') and not isinstance(sv, str):
                    sv = sv[-1]
                feature_importance.append({
                    "feature": feat,
                    "value": round(row_data[feat], 4),
                    "shap_value": float(sv)
                })
            
            # Sort top 10
            feature_importance = sorted(feature_importance, key=lambda x: abs(x["shap_value"]), reverse=True)[:10]
            
            results.append({
                "prediction": "Fraud" if predictions[row_idx] == 1 else "Legitimate",
                "fraud_probability": float(prediction_probas[row_idx]),
                "shap_explanation": feature_importance
            })
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
