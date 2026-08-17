# FieldServe Report Test Evidence

Verified on 17 August 2026. Run Django tests inside Docker because the backend requires GDAL/PostGIS.

## 1. Complete backend suite

```powershell
docker compose exec -T backend pytest -q
```

Result: **32 passed**, 16 warnings, 16.36 s. The warnings only report that `/app/staticfiles/` is absent in the test container.

### Analytics feature construction (4 tests)

- `test_features_all_none_for_jobless_customer`
- `test_features_reflect_single_completed_job`
- `test_cancellation_rate`
- `test_is_uk_flag`

Supports the correctness of churn input-feature construction.

### Analytics signals (2 tests)

- `test_job_save_updates_last_seen_at`
- `test_signal_swallows_ml_errors`

Supports event-driven analytics updates and graceful ML-service failure handling.

### Django-to-FastAPI client (3 tests)

- `test_predict_churn_returns_parsed_body`
- `test_admin_call_without_token_raises`
- `test_non_2xx_raises`

Supports service integration, administrative authentication, and upstream error handling.

### Public booking (6 tests)

- `test_public_business_detail`
- `test_public_service_list`
- `test_public_booking_creates_customer_and_job`
- `test_public_booking_finds_existing_customer_by_email`
- `test_public_booking_requires_contact`
- `test_public_booking_disabled`

Supports the unauthenticated customer booking workflow, customer reuse, validation, and business-level enable/disable control.

### Guided inspections (4 tests)

- `test_create_inspection_uploads_photo_and_runs_analysis`
- `test_ml_failure_still_persists_inspection`
- `test_cannot_attach_inspection_to_other_business_job`
- `test_check_frame_proxies_ml_response`

Supports image upload and analysis, failure persistence, tenant isolation, and framing-guidance integration.

### Road routing (2 tests)

- `test_road_route_returns_road_geometry`
- `test_road_route_requires_at_least_two_points`

Supports route geometry output and input validation.

### Deterministic scheduling (7 tests)

- `test_outside_hours_rejected`
- `test_end_after_close_rejected`
- `test_buffer_conflict_no_coords`
- `test_ok_when_gap_meets_floor`
- `test_distance_dominates_floor`
- `test_exclude_job_id_ignores_self`
- `test_cancelled_jobs_ignored`

Supports working-hour boundaries, overlap/travel-buffer enforcement, distance-aware buffers, edit behaviour, and cancellation handling.

### Walkaround workflow gates (4 tests)

- `test_start_job_requires_complete_walkaround`
- `test_start_job_after_all_required_images`
- `test_complete_job_requires_after_walkaround`
- `test_complete_job_after_all_after_images`

Supports the before/after eight-view inspection requirements.

## 2. Focused scheduler and booking suite

```powershell
docker compose exec -T backend pytest jobs/tests/test_scheduling_utils.py businesses/tests/test_public_booking.py -q
```

Result: **13 passed**, 6 warnings, 9.54 s. This is the narrow result to cite in Chapter 5.3.

## 3. FastAPI smoke checks

Check `/health`, `/version`, `/vision/status`, and `/openapi.json` at `http://localhost:8001`.

Result: all returned HTTP 200. Version was `0.3.0`; vision status reported a real loaded model, `yolov8n-cardd-5c2d7c9`, with deployed weights present.

These are deployment/integration smoke checks, not substitutes for endpoint unit tests or model evaluation.

## 4. Frontend static checks

```powershell
cd fieldserve-crm
npm run lint
npx tsc --noEmit
```

Current results:

- ESLint: **failed**, 7 errors and 32 warnings.
- TypeScript: **failed**, 2 errors in `app/(auth)/sign-in.tsx`.
- No frontend `*.test.*` or `*.spec.*` files exist.

Do not report the frontend as passing until these checks are corrected and rerun. Add component/integration tests for public booking, slot recommendations, inspection capture, damage overlays, churn cards, and heat-map rendering.

## 5. Model evaluation useful to the report

### Churn (RQ1)

Retain the leakage-safe held-out comparison already in the notebook/report: PR-AUC, ROC-AUC, F1, Brier score, calibration/risk bands, PR/ROC curves, and coefficients or feature importance. The deployed bundle confirms risk thresholds of High >= 0.65 and Medium >= 0.35.

### Vehicle damage (RQ2)

Validation results are present, but the final report still needs evaluation on the held-out CarDD `test.json` split (374 images). Report overall and per-class precision, recall, mAP@50, and mAP@50-95, plus confusion matrix and prediction examples. Do not substitute the FastAPI health check for held-out accuracy.

### KDE demand mapping (RQ3)

The executed notebook used 96,210 located records and selected bandwidth 0.236 degrees by five-fold CV. Spatial-fold log-likelihood was -203.1629 +/- 335.0770 per point. The very large spread means geographic generalisation is unstable; do not use the notebook template's claim that estimates were stable. The proposal's "top-three peaks within 500 m of known generator hotspots" criterion cannot be evaluated on observational Olist data without separately defined ground-truth generator hotspots.

## 6. Verified visual evidence

The Week 18 evidence folders contain the report-ready visual evidence integrated into report version 4:

- `FieldServe - System Architecture/`: six rendered architecture diagrams, including the high-level map, backend app ownership, ML data flow, deployment, and authentication/multi-tenancy views.
- `Fieldserve - Application images/`: implemented heat map, guided walkaround and framing guidance, before/after inspection reports, and rendered damage-box/summary screens.
- `Fieldserve - Churn results/`: PR/ROC curves, XGBoost feature importance, and risk-band output captures.

These screenshots are implementation and presentation evidence. They do not substitute for the quantitative or participant evidence listed below.

## 7. Still-needed human and non-functional evidence

- Two-round usability test with participant roles/recruitment, task completion, time on task, SUS, changes between rounds, and coded comments.
- API latency/load test with stated hardware, concurrency, request mix, percentiles, and error rate.
- Explicit inspection-image consent, retention, access, and deletion-policy review.
- Cross-device checks on Android, iOS, and web where claimed.
- Security checks for authentication, tenant isolation, upload type/size limits, throttling, and unauthorised object access.
