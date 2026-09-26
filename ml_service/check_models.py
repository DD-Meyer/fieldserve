from utils.model_registry import load_churn_bundle

bundle = load_churn_bundle()
model = bundle["model"]
imputer = bundle.get("imputer")

print(f"Model: {bundle.get('model_name', type(model).__name__)}")
print(f"Feature set: {bundle.get('feature_set_label', 'unknown')}")
print(f"Artifact: {bundle['_artefact_path']}")
print(f"Estimator: {type(model).__name__}")
print(f"Imputer: {type(imputer).__name__ if imputer is not None else 'none'}")
print(f"Feature count: {len(bundle.get('feature_names') or [])}")

for name, step in getattr(model, "steps", []):
    print(f"Pipeline step {name}: {type(step).__name__}")

if hasattr(model, "feature_importances_"):
    print(f"Feature importances: {len(model.feature_importances_)}")