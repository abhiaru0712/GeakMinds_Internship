from fastapi import FastAPI, HTTPException, Request, UploadFile, File
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
import sqlite3
import json
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

warnings.filterwarnings('ignore')

app = FastAPI(title="Fraud Detection API with Explainable AI")

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
SRC_DIR = os.path.join(BASE_DIR, 'src')
DB_PATH = os.path.join(BASE_DIR, 'predictions.db')

# Initialize SQLite DB
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL,
            time REAL,
            prediction TEXT,
            probability REAL,
            shap_values TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

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
        
        pred_label = "Fraud" if prediction == 1 else "Legitimate"
        prob = float(prediction_proba)
        
        # Log to DB
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO transactions (amount, time, prediction, probability, shap_values) VALUES (?, ?, ?, ?, ?)",
            (formatted_data.get("Amount", 0.0), formatted_data.get("Time", 0.0), pred_label, prob, json.dumps(top_features))
        )
        conn.commit()
        conn.close()
        
        return {
            "prediction": pred_label,
            "fraud_probability": prob,
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
        db_records = []
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
            
            pred_label = "Fraud" if predictions[row_idx] == 1 else "Legitimate"
            prob = float(prediction_probas[row_idx])
            
            results.append({
                "prediction": pred_label,
                "fraud_probability": prob,
                "shap_explanation": feature_importance
            })
            
            db_records.append((
                row_data.get("Amount", 0.0),
                row_data.get("Time", 0.0),
                pred_label,
                prob,
                json.dumps(feature_importance)
            ))
            
        # Log all to DB
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.executemany(
            "INSERT INTO transactions (amount, time, prediction, probability, shap_values) VALUES (?, ?, ?, ?, ?)",
            db_records
        )
        conn.commit()
        conn.close()
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_csv")
async def predict_csv_endpoint(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded.")
    
    try:
        df_raw = pd.read_csv(file.file)
        
        # Prepare valid data frame based on exact required features and fillna
        formatted_data = {}
        for f in feature_names:
            if f in df_raw.columns:
                formatted_data[f] = pd.to_numeric(df_raw[f], errors='coerce').fillna(0.0)
            elif f.lower() in [col.lower() for col in df_raw.columns]:
                # find matching case-insensitive
                match = next(c for c in df_raw.columns if c.lower() == f.lower())
                formatted_data[f] = pd.to_numeric(df_raw[match], errors='coerce').fillna(0.0)
            else:
                formatted_data[f] = 0.0
                
        df = pd.DataFrame(formatted_data)
        
        # Fast vectorized prediction
        predictions = model.predict(df)
        prediction_probas = model.predict_proba(df)[:, 1]
        
        # Prepare DB insert (SKIP SHAP on massive batch to prevent 1-hour loops)
        # We only compute SHAP if it's fraudulent to save time
        db_records = []
        
        amounts = df_raw['Amount'].fillna(0.0).tolist() if 'Amount' in df_raw.columns else [0.0] * len(df)
        times = df_raw['Time'].fillna(0.0).tolist() if 'Time' in df_raw.columns else [0.0] * len(df)
        
        # We will calculate SHAP only for the first handful of frauds to avoid timeout in massive data
        shap_fraud_limit = 50
        fraud_shap_count = 0
        
        for i in range(len(df)):
            pred_label = "Fraud" if predictions[i] == 1 else "Legitimate"
            prob = float(prediction_probas[i])
            
            shap_json = "[]"
            # Optional: If you want SHAP for fraud records during CSV ingest
            if pred_label == "Fraud" and fraud_shap_count < shap_fraud_limit and explainer is not None:
                row_df = df.iloc[[i]]
                sv_obj = explainer(row_df)
                s_vals = sv_obj.values[0]
                feat_imp = []
                for j, feat in enumerate(feature_names):
                    v = s_vals[j]
                    if hasattr(v, '__iter__') and not isinstance(v, str): v = v[-1]
                    feat_imp.append({"feature": feat, "value": float(row_df[feat].iloc[0]), "shap_value": float(v)})
                feat_imp = sorted(feat_imp, key=lambda x: abs(x["shap_value"]), reverse=True)[:10]
                shap_json = json.dumps(feat_imp)
                fraud_shap_count += 1
                
            db_records.append((
                float(amounts[i]),
                float(times[i]),
                pred_label,
                prob,
                shap_json
            ))
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.executemany(
            "INSERT INTO transactions (amount, time, prediction, probability, shap_values) VALUES (?, ?, ?, ?, ?)",
            db_records
        )
        conn.commit()
        conn.close()
        
        total = len(db_records)
        fraud = int(sum(predictions))
        legit = total - fraud
        
        return {
            "message": "CSV processed successfully",
            "total": total,
            "fraud": fraud,
            "legit": legit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/predictions")
async def get_predictions(limit: int = 100):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    predictions = []
    for r in rows:
        predictions.append({
            "id": r["id"],
            "amount": r["amount"],
            "time": r["time"],
            "prediction": r["prediction"],
            "probability": r["probability"],
            "shapValues": json.loads(r["shap_values"]) if r["shap_values"] else [],
            "created_at": r["created_at"]
        })
    return predictions

@app.get("/api/dashboard_stats")
async def get_dashboard_stats():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Basic counts
    cursor.execute("SELECT COUNT(*) as total, SUM(CASE WHEN prediction='Fraud' THEN 1 ELSE 0 END) as fraud_count FROM transactions")
    row = cursor.fetchone()
    total = row["total"] or 0
    fraud = row["fraud_count"] or 0
    legit = total - fraud
    
    # Amount distribution
    cursor.execute('''
        SELECT 
            SUM(CASE WHEN amount < 50 THEN 1 ELSE 0 END) as range_1,
            SUM(CASE WHEN amount >= 50 AND amount < 200 THEN 1 ELSE 0 END) as range_2,
            SUM(CASE WHEN amount >= 200 AND amount < 500 THEN 1 ELSE 0 END) as range_3,
            SUM(CASE WHEN amount >= 500 AND amount < 1000 THEN 1 ELSE 0 END) as range_4,
            SUM(CASE WHEN amount >= 1000 AND amount < 5000 THEN 1 ELSE 0 END) as range_5,
            SUM(CASE WHEN amount >= 5000 THEN 1 ELSE 0 END) as range_6
        FROM transactions
    ''')
    dist_row = cursor.fetchone()
    
    # Fraud per amount distribution
    cursor.execute('''
        SELECT 
            SUM(CASE WHEN amount < 50 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_1,
            SUM(CASE WHEN amount >= 50 AND amount < 200 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_2,
            SUM(CASE WHEN amount >= 200 AND amount < 500 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_3,
            SUM(CASE WHEN amount >= 500 AND amount < 1000 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_4,
            SUM(CASE WHEN amount >= 1000 AND amount < 5000 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_5,
            SUM(CASE WHEN amount >= 5000 AND prediction='Fraud' THEN 1 ELSE 0 END) as range_6
        FROM transactions
    ''')
    dist_fraud_row = cursor.fetchone()
    conn.close()
    
    distribution_data = [
        { "range": "$0-50", "legit": (dist_row["range_1"] or 0) - (dist_fraud_row["range_1"] or 0), "fraud": dist_fraud_row["range_1"] or 0 },
        { "range": "$50-200", "legit": (dist_row["range_2"] or 0) - (dist_fraud_row["range_2"] or 0), "fraud": dist_fraud_row["range_2"] or 0 },
        { "range": "$200-500", "legit": (dist_row["range_3"] or 0) - (dist_fraud_row["range_3"] or 0), "fraud": dist_fraud_row["range_3"] or 0 },
        { "range": "$500-1K", "legit": (dist_row["range_4"] or 0) - (dist_fraud_row["range_4"] or 0), "fraud": dist_fraud_row["range_4"] or 0 },
        { "range": "$1K-5K", "legit": (dist_row["range_5"] or 0) - (dist_fraud_row["range_5"] or 0), "fraud": dist_fraud_row["range_5"] or 0 },
        { "range": "$5K+", "legit": (dist_row["range_6"] or 0) - (dist_fraud_row["range_6"] or 0), "fraud": dist_fraud_row["range_6"] or 0 },
    ]
    
    return {
        "total": total,
        "fraud": fraud,
        "legit": legit,
        "distribution": distribution_data
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
