# FieldServe Final Report Handoff for Claude

Updated: 21 September 2026

This file summarises the current implementation state after the latest Docker-backed validation and ML retraining work. It is intended as a concise source document for drafting the final CM3070 report.

## 1. Current System Position

FieldServe is now a working mobile-first field-service CRM with three active model-backed capabilities running through a Django REST backend and FastAPI ML service:

- Customer churn prediction and retraining.
- Spatial demand heatmaps, now including a persisted forecast bundle for future opportunity zones.
- Vehicle damage detection using a YOLOv8 CarDD model, now with a reviewed-annotation retraining pipeline structure.

The main stack remains:

- React Native / Expo CRM app in `fieldserve-crm/`.
- Django REST backend in `fieldserve_backend/`.
- FastAPI ML microservice in `ml_service/`.
- PostgreSQL/PostGIS via Docker Compose.
- Docker Compose orchestration for backend, database, ML service, and scheduler.

## 2. Important Recent Changes

### 2.1 Churn Retraining

Churn retraining was validated end to end in Docker.

What now works:

- Django collects churn labels from mature historical churn scores.
- `retrain_churn` sends labelled feature rows to FastAPI.
- FastAPI trains a new churn model from supplied features.
- The live model is hot-swapped through the existing reload path.
- The backend can score live customer/job data against the retrained model.

Validation evidence:

```text
Started RetrainRun#1 with 385 samples
Trained XGBoost on 385 samples
metrics={'pr_auc': 0.9996, 'roc_auc': 0.9972, 'f1': 0.9846, 'brier_score': 0.0214}
Hot-swap complete - mode=model, trained_at=2026-09-21T17:55:58
```

Post-retrain scoring evidence:

```text
Scoring 80 customer(s) in batches of 40
Done. would write 80 ChurnScore rows (model=XGBoost, version=2026-09-21T17:55:58).
```

Report wording:

> The churn model supports supervised retraining from labelled live business data. In the September Docker validation, a seeded evidence business generated mature churn labels, the backend submitted 385 labelled feature rows to FastAPI, and FastAPI trained and hot-swapped an XGBoost model. A subsequent scoring dry run confirmed the backend could use the new model version against live customer/job records.

### 2.2 Heatmap Forecast Retraining

The heatmap feature previously fitted request-time KDE from submitted points. It now also has a persisted retrainable forecast model.

New files and changes:

- `ml_service/training/heatmap.py`
- `ml_service/routers/admin.py`
- `ml_service/routers/heatmap.py`
- `fieldserve_backend/analytics/management/commands/retrain_heatmap.py`
- `fieldserve_backend/analytics/ml_client.py`
- `fieldserve_backend/analytics/predictions.py`
- `fieldserve-crm/lib/hooks/usePredictions.ts`

What now works:

- Django exports customer and completed-job geodata from live records.
- FastAPI trains a persisted `KernelDensity` demand-forecast bundle.
- The candidate bundle is evaluated against the current bundle using temporal validation log-likelihood.
- The candidate is promoted only if it passes the metric gate.
- The backend can request forecast mode and receive future opportunity zones.

Validation evidence from backend retrain command:

```text
python manage.py retrain_heatmap --business-id 14 --min-samples 20 --min-delta 0
Heatmap forecast candidate promoted: n=440, bandwidth=0.002,
metrics={'validation_log_likelihood': 6.402953,
'previous_validation_log_likelihood': 2.352511,
'log_likelihood_delta': 4.050442,
'validation_points': 88.0}, reason=promoted
```

Backend forecast endpoint evidence:

```text
status: 200
computation_mode: forecast_kde_bundle
forecast_horizon_days: 45
input_point_count: 440
cells: 100
opportunity_zones: 8
model_version: present
```

Important report nuance:

- The system does not predict named future individual customers.
- The model predicts future demand/opportunity zones from historic customer and job geography.
- This is the defensible language for the report: “future opportunity zones” or “forecast demand areas”.

Report wording:

> The heatmap component was extended from live request-time KDE into a retrainable demand-forecast pipeline. Django now exports tenant-scoped customer and completed-job locations to FastAPI, where a persisted KernelDensity bundle is trained and temporally validated. Candidate bundles are promoted only when validation log-likelihood improves. The CRM can still request current live KDE density, but can also request forecast mode, which returns ranked future opportunity zones with confidence bands and model metadata.

### 2.3 Vehicle Damage YOLO Retraining Pipeline

Vehicle damage inference was already live with a real YOLOv8 CarDD model. The new work adds a trustworthy retraining path rather than using model predictions as ground truth.

New files and changes:

- `fieldserve_backend/inspections/models.py`
- `fieldserve_backend/inspections/migrations/0003_damageannotation.py`
- `fieldserve_backend/inspections/serializers.py`
- `fieldserve_backend/inspections/views.py`
- `fieldserve_backend/inspections/admin.py`
- `fieldserve_backend/inspections/management/commands/export_damage_yolo.py`
- `fieldserve_backend/inspections/management/commands/retrain_vehicle_damage.py`
- `ml_service/models/computer_vision/train_vehicle_damage.py`
- `ml_service/routers/admin.py`
- `fieldserve_backend/analytics/ml_client.py`
- `docker-compose.yml`

What now works structurally:

- Existing inspection images can be reviewed and approved as training labels.
- `DamageAnnotation` stores approved bounding boxes, reviewer, review time, split, and export status.
- The backend can export approved annotations to YOLO format.
- Backend and ML service share `/exports` through Docker Compose.
- FastAPI exposes `POST /admin/train/vision` for gated YOLO candidate training.
- The YOLO training script now writes candidate weights and a JSON manifest.
- Active weights are promoted only when `--promote` is used and the candidate passes the mAP gate.

Validation evidence from existing completed-job inspection image:

```text
completed_job_inspection_photos 37
selected_inspection_id 38
selected_job_id 989
selected_job_status completed
selected_photo inspections/2026/08/after-front_right.jpg
analysis_status done
mode model
model_version yolov8n-cardd-5c2d7c9
damage_total 3
image_size {'width': 3840, 'height': 2160}
```

Frame validation evidence:

```text
frame_ready True
frame_reason ready
frame_guidance Hold steady
vehicle confidence 0.953
```

YOLO annotation/export evidence:

```text
annotation_id 1
boxes 3
approved True
Exported 1 annotation(s) to /exports/vehicle_damage_yolo
```

Generated YOLO label example:

```text
1 0.520703 0.684491 0.052917 0.114815
1 0.416966 0.525463 0.163828 0.190648
1 0.471667 0.525417 0.293281 0.203241
```

ML vision training endpoint guard evidence:

```text
POST /admin/train/vision with missing data_yaml -> 400
{"detail":"data_yaml does not exist: /exports/missing/data.yaml"}
```

Safe threshold behaviour:

```text
python manage.py retrain_vehicle_damage --min-annotations 999
Only 1 approved annotation(s); need >= 999. Skipping.
```

Important report nuance:

- A full YOLO training job was not run during this implementation pass because it is compute-heavy and currently only one approved test annotation exists.
- The correct claim is that the retraining pipeline is implemented structurally and safely, with reviewed-label export and gated promotion. Full model improvement requires a larger reviewed annotation set.

Report wording:

> The vehicle-damage model now has a supervised retraining pipeline design based on human-reviewed inspection annotations. Model predictions are not treated as ground truth by default; instead, staff review or correct detection boxes before export. Approved annotations are converted to YOLO format and shared with the FastAPI ML service, where candidate weights can be trained and evaluated against the deployed model. Promotion is gated by mAP-based comparison, preventing automatic replacement by a worse model.

## 3. Scheduler / Automation State

`run_scheduler.py` now includes configurable retraining loops for all three model features.

Default cadences:

| Feature | Default cadence | Threshold |
|---|---:|---:|
| Churn retrain | 24 hours | 50 unused churn labels |
| Heatmap retrain | 24 hours | 20 geospatial samples |
| YOLO retrain | 168 hours / 7 days | 20 approved annotations |

Relevant environment variables:

```text
SCHEDULER_RETRAIN_INTERVAL_HOURS
SCHEDULER_RETRAIN_MIN_SAMPLES
SCHEDULER_HEATMAP_RETRAIN_INTERVAL_HOURS
SCHEDULER_HEATMAP_MIN_SAMPLES
SCHEDULER_VISION_RETRAIN_INTERVAL_HOURS
SCHEDULER_VISION_MIN_ANNOTATIONS
```

Report wording:

> The scheduler now checks daily for churn and heatmap retraining opportunities and weekly for vision retraining, with all jobs threshold-gated to avoid training on insufficient data. Each command exits safely when insufficient labels, geo-points, or approved annotations exist.

## 4. FastAPI Training Responsibility

FastAPI is the ML training authority for the model artefacts.

| Feature | Training endpoint / path | Django role | FastAPI role |
|---|---|---|---|
| Churn | `/admin/train/from_features` | Sends labelled feature rows | Trains, saves, reloads model |
| Heatmap forecast | `/admin/train/heatmap` | Sends customer/job geodata | Trains/evaluates/promotes KDE bundle |
| YOLO damage | `/admin/train/vision` | Exports reviewed annotations | Runs candidate training/evaluation/promotion |

Report wording:

> Django orchestrates data extraction and scheduling, while FastAPI owns model training, evaluation, artefact creation, and live model serving. This separation keeps tenant-aware business logic in Django and numerical/model lifecycle operations in the ML service.

## 5. Validation Commands and Results

Commands that were run successfully:

```powershell
docker compose exec -T backend python manage.py migrate inspections
```

Result:

```text
Applying inspections.0003_damageannotation... OK
```

```powershell
docker compose exec -T backend python manage.py check
```

Result:

```text
System check identified no issues (0 silenced).
```

```powershell
docker compose exec -T backend python manage.py retrain_heatmap --business-id 14 --min-samples 20 --min-delta 0
```

Result: promoted candidate heatmap bundle from 440 points.

```powershell
docker compose exec -T backend python manage.py retrain_heatmap --business-id 14 --min-samples 20 --min-delta 999
```

Result: candidate correctly rejected due to impossible threshold.

```powershell
docker compose exec -T backend python manage.py export_damage_yolo --out /exports/vehicle_damage_yolo --include-exported
```

Result: exported one approved annotation into YOLO format.

```powershell
docker compose exec -T backend python manage.py retrain_vehicle_damage --min-annotations 999
```

Result: skipped cleanly because only one approved annotation exists.

Limitations of validation:

- The freshly recreated backend container did not have `pytest` installed, so the existing pytest suite was not rerun after the last implementation pass.
- `python manage.py check` passed.
- Focused compile checks passed for the changed Python modules.
- Full YOLO training was not executed due to compute cost and insufficient approved annotations.
- `npx tsc --noEmit` still fails on unrelated pre-existing CRM files: `app/(auth)/sign-up.tsx`, `app/settings.tsx`, and `components/RouteMap.tsx`. The edited heatmap hook itself showed no VS Code diagnostics.

## 6. Current Technical Caveats

Use these carefully in the final report.

1. Churn retraining is fully demonstrated end to end.
2. Heatmap forecast retraining is demonstrated end to end with live Django geodata and promoted bundle output.
3. Vehicle-damage inference is demonstrated with the deployed YOLO model on existing inspection images.
4. Vehicle-damage retraining is implemented as a safe reviewed-label pipeline but has not yet run a full training job because more approved annotations are needed.
5. Heatmap forecast predicts opportunity zones, not named future customers.
6. Generated artefacts currently include `ml_service/models/churn/churn_model.joblib`, `ml_service/models/heatmap/heatmap_model.joblib`, and exported YOLO data under `fieldserve_backend/exports/`.
7. `.env` was updated locally with `ML_INTERNAL_TOKEN=local-dev-retrain-token` for Docker validation.

## 7. Suggested Final Report Structure From This Work

### Methodology / Implementation

- Explain separation of concerns: Django for tenant-scoped data extraction, FastAPI for model lifecycle.
- Churn: supervised retraining from mature labels.
- Heatmap: KDE live density plus persisted forecast bundle using temporal validation.
- Vision: YOLO inference plus human-reviewed annotation loop and gated candidate promotion.

### Evaluation

- Churn: cite Docker retrain and post-retrain scoring dry run.
- Heatmap: cite promoted forecast bundle, 440 geospatial samples, validation log-likelihood improvement.
- Vision: cite live inference on completed-job inspection image, 3 detected damages, model mode, frame validation; describe retraining pipeline as implemented but not quantitatively retrained yet.

### Discussion / Limitations

- YOLO retraining needs a larger manually reviewed dataset before claiming improved model accuracy.
- Forecast zones are opportunity estimates from historic demand, not guaranteed future customers.
- More frontend static checks and formal usability/non-functional evaluation are still needed for strong final evidence.

## 8. High-Signal One-Paragraph Summary

FieldServe currently sits as a Docker-validated full-stack prototype with live Django business data feeding FastAPI ML services. Churn prediction is fully retrainable and was validated by training and hot-swapping an XGBoost model from 385 labelled samples. Spatial heatmapping now supports both live request-time KDE and a retrainable forecast bundle trained from customer/job geodata; a promoted forecast model was validated on 440 live geospatial samples and returns ranked future opportunity zones. Vehicle damage detection runs with a real YOLOv8 CarDD model and was validated on an existing completed-job inspection image, producing three detections and a ready frame-validation result. A safe YOLO retraining pipeline has also been implemented using human-reviewed annotations, YOLO-format export, FastAPI candidate training, and metric-gated promotion, although full YOLO retraining still requires a larger approved annotation set before accuracy improvement can be claimed.