import joblib

m = joblib.load("./models/churn_pred_model.joblib")

print("Pipeline steps:")
for name, step in m.steps:
    print(f"  - {name}: {type(step).__name__}")

# Inspect each step for feature info
print("\nPer-step feature info:")
for name, step in m.steps:
    print(f"\n  step={name}")
    print(f"    feature_names_in_ : {getattr(step, 'feature_names_in_', None)}")
    print(f"    n_features_in_    : {getattr(step, 'n_features_in_', None)}")
    # ColumnTransformer carries the spec
    if hasattr(step, "transformers_"):
        for tname, transformer, cols in step.transformers_:
            print(f"    transformer {tname!r}: cols={cols}")
    # Final estimator with coefficients
    if hasattr(step, "coef_"):
        print(f"    coef_ shape       : {step.coef_.shape}")
    if hasattr(step, "feature_importances_"):
        print(f"    n_importances     : {len(step.feature_importances_)}")