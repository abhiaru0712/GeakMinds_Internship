import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import shap

def main():
    print("Starting Training Pipeline...")
    
    # Define paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_PATH = os.path.join(BASE_DIR, 'data', 'creditcard.csv')
    MODEL_DIR = os.path.join(BASE_DIR, 'model')
    
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)

    # 1. Load Data
    print(f"Loading data from {DATA_PATH}...")
    try:
        df = pd.read_csv(DATA_PATH)
    except FileNotFoundError:
        print(f"Error: Dataset not found at {DATA_PATH}")
        return

    # 2. Preprocess Data
    print("Preprocessing data...")
    # The 'Class' column contains our labels: 1 for fraud, 0 for legitimate
    X = df.drop('Class', axis=1)
    y = df['Class']

    # Split into train and test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training shape: {X_train.shape}, Test shape: {X_test.shape}")

    # 3. Model Training
    # Using RandomForest with balanced class weight due to high imbalance
    print("Training RandomForest model (this might take a few minutes)...")
    model = RandomForestClassifier(
        n_estimators=50, 
        max_depth=10, 
        n_jobs=-1, 
        random_state=42, 
        class_weight='balanced'
    )
    model.fit(X_train, y_train)

    # 4. Evaluation
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # 5. Explainable AI with SHAP
    print("Generating SHAP Explainer...")
    # To keep the explainer performant, we use a sample of the background data
    background_data = shap.sample(X_train, 100)
    explainer = shap.TreeExplainer(model, feature_perturbation="tree_path_dependent")
    
    # 6. Saving Models
    print(f"Saving artifacts to {MODEL_DIR}...")
    model_path = os.path.join(MODEL_DIR, 'trained_model.pkl')
    explainer_path = os.path.join(MODEL_DIR, 'shap_explainer.pkl')
    
    joblib.dump(model, model_path)
    print(f"Model saved to: {model_path}")
    
    # The TreeExplainer can be large or tricky to pickle directly sometimes,
    # but joblib handles it reasonably well for RF.
    try:
        joblib.dump(explainer, explainer_path)
        print(f"Explainer saved to: {explainer_path}")
    except Exception as e:
        print(f"Warning: Could not save explainer directly ({e}). The API will initialize it on the fly.")

    # Save expected feature names for API validation
    features_path = os.path.join(MODEL_DIR, 'features.joblib')
    joblib.dump(list(X.columns), features_path)
    
    print("Training Pipeline successfully complete!")

if __name__ == "__main__":
    main()
