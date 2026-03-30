# Fraud Detection with Explainable AI

This project builds a classification model to identify fraudulent credit card transactions and explains the predictions using SHAP (SHapley Additive exPlanations).

## Directory Structure

- `data/` - Contains the `creditcard.csv` dataset.
- `notebooks/` - Contains references to Jupyter Notebooks for EDA, feature engineering, and modeling.
- `model/` - Auto-generated directory containing the serialized RandomForest model and SHAP tree explainer (`trained_model.pkl` & `shap_explainer.pkl`).
- `src/` - The source code for model training and the FastAPI server + UI.
- `presentation/` - Area for capstone presentation assets.

## Quick Start

### 1. Install Requirements
The project requires the following dependencies:
```bash
pip install pandas scikit-learn shap joblib fastapi uvicorn pydantic
```

### 2. Train the Model
Ensure `data/creditcard.csv` is present. Run the following command from the project root:
```bash
python src/training_pipeline.py
```
This will train the model, save it, and generate the TreeExplainer.

### 3. Launch the Web Dashboard
Start the real-time AI dashboard powered by FastAPI:
```bash
uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload
```
Open `http://127.0.0.1:8000/` in your browser.

## Features Let's Explore
- **High-Performance Modeling:** Utilizes a RandomForest with balanced weights to elegantly handle class imbalances.
- **Glassmorphic UI:** A beautifully designed frontend tailored for financial ops.
- **Explainable AI:** SHAP evaluates exactly which features triggered the "Fraud" flag vs "Legitimate" flag in real time.
