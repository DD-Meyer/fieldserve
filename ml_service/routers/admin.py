"""Admin endpoints for the FieldServe ML service.

These are protected by a shared-secret header ``X-Internal-Token`` because
they retrain and hot-reload models. The token is read from the environment
variable ``ML_INTERNAL_TOKEN``; if the variable is empty or unset, all admin
endpoints are disabled (the dependency raises 503).
"""

from __future__ import annotations

import logging
import os
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, List

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from features.churn import EXT_FEATURES
from routers import churn as churn_router
from training.churn import train_from_csv, train_from_features
from training.heatmap import train_and_maybe_promote

log = logging.getLogger(__name__)
router = APIRouter(tags=["admin"], prefix="/admin")


def _require_token(x_internal_token: str | None) -> None:
    expected = os.environ.get("ML_INTERNAL_TOKEN", "")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints disabled (ML_INTERNAL_TOKEN not set).",
        )
    if x_internal_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-Internal-Token.",
        )


# ---------------------------------------------------------------------------
# /admin/reload  - hot-swap the in-memory model to the latest on-disk artefact
# ---------------------------------------------------------------------------


@router.post("/reload")
def reload_model(x_internal_token: str | None = Header(default=None)) -> dict[str, Any]:
    """Re-read ``models/churn/churn_model.joblib`` and swap the live model."""
    _require_token(x_internal_token)
    return churn_router.reload_bundle()


# ---------------------------------------------------------------------------
# /admin/train  - retrain from data the caller supplies
# ---------------------------------------------------------------------------


class TrainFromFeaturesRow(BaseModel):
    """One pre-engineered training row.

    Must include every feature in `features.churn.EXT_FEATURES` plus a binary
    `churned` label. Missing feature values are imputed by the trainer.
    """

    churned: int = Field(..., ge=0, le=1)
    recency_days: float | None = None
    tenure_days: float | None = None
    freq_12m: float | None = None
    freq_3m: float | None = None
    avg_inter_booking_gap: float | None = None
    inter_booking_gap_std: float | None = None
    total_spend_12m: float | None = None
    avg_ticket: float | None = None
    monetary_trend: float | None = None
    spend_per_visit_std: float | None = None
    spend_per_visit_cv: float | None = None
    cancellation_rate: float | None = None
    unique_item_types: float | None = None
    total_units: float | None = None
    weekend_share: float | None = None
    evening_share: float | None = None
    is_uk: float | None = None


class TrainFromFeaturesRequest(BaseModel):
    data_source: str = Field(
        "django-supplied features",
        description="Free-form label written into the bundle's `data_source` field.",
    )
    rows: List[TrainFromFeaturesRow]


class TrainFromCsvRequest(BaseModel):
    data_dir: str = Field(
        "data/online_retail",
        description="Directory (relative to the ml_service working dir) holding the Online Retail II files.",
    )


class TrainResponse(BaseModel):
    artefact_path: str
    model_name: str
    feature_set_label: str
    metrics: dict[str, float]
    trained_at: str
    n_samples: int


class HeatmapTrainingPoint(BaseModel):
    latitude: float
    longitude: float
    weight: float = 1.0
    observed_at: str | None = None
    source: str = "unknown"


class HeatmapTrainRequest(BaseModel):
    data_source: str = "django-analytics"
    rows: List[HeatmapTrainingPoint]
    min_samples: int = Field(20, ge=2)
    min_log_likelihood_delta: float = 0.0


class HeatmapTrainResponse(BaseModel):
    promoted: bool
    reason: str
    artefact_path: str
    metrics: dict[str, float]
    previous_metrics: dict[str, float]
    trained_at: str
    n_samples: int
    bandwidth: float


class VisionTrainRequest(BaseModel):
    data_yaml: str
    epochs: int = Field(50, ge=1, le=300)
    imgsz: int = Field(640, ge=128, le=1280)
    batch: int = Field(16, ge=1, le=128)
    model: str = "yolov8n.pt"
    min_map_delta: float = 0.0
    promote: bool = True
    timeout_seconds: int = Field(7200, ge=60, le=86400)


class VisionTrainResponse(BaseModel):
    returncode: int
    manifest: dict[str, Any] | None = None
    stdout: str
    stderr: str


@router.post("/train/from_features", response_model=TrainResponse)
def train_from_features_endpoint(
    payload: TrainFromFeaturesRequest,
    x_internal_token: str | None = Header(default=None),
) -> TrainResponse:
    """Retrain from a JSON list of pre-engineered rows + labels.

    Does *not* auto-reload - call ``POST /admin/reload`` once you've verified
    the new metrics in the response.
    """
    _require_token(x_internal_token)

    rows = [r.model_dump() for r in payload.rows]
    if not rows:
        raise HTTPException(status_code=400, detail="`rows` must be non-empty.")

    frame = pd.DataFrame(rows)
    # ensure every feature column is present (Pydantic guarantees this already
    # but be explicit for traceability)
    for col in EXT_FEATURES:
        if col not in frame.columns:
            frame[col] = None

    path, bundle = train_from_features(frame, data_source=payload.data_source)
    return TrainResponse(
        artefact_path=str(path),
        model_name=bundle["model_name"],
        feature_set_label=bundle["feature_set_label"],
        metrics=bundle["metrics"],
        trained_at=bundle["trained_at"],
        n_samples=len(rows),
    )


@router.post("/train/from_csv", response_model=TrainResponse)
def train_from_csv_endpoint(
    payload: TrainFromCsvRequest,
    x_internal_token: str | None = Header(default=None),
) -> TrainResponse:
    """Retrain from local CSV/XLSX files (Online Retail II layout)."""
    _require_token(x_internal_token)

    data_dir = Path(payload.data_dir)
    if not data_dir.exists():
        raise HTTPException(status_code=400, detail=f"data_dir does not exist: {data_dir}")

    path, bundle = train_from_csv(data_dir)
    return TrainResponse(
        artefact_path=str(path),
        model_name=bundle["model_name"],
        feature_set_label=bundle["feature_set_label"],
        metrics=bundle["metrics"],
        trained_at=bundle["trained_at"],
        n_samples=int(bundle["churn_definition"].get("training_churn_rate") is not None) * 0,  # unknown w/o re-counting
    )


@router.post("/train/heatmap", response_model=HeatmapTrainResponse)
def train_heatmap_endpoint(
    payload: HeatmapTrainRequest,
    x_internal_token: str | None = Header(default=None),
) -> HeatmapTrainResponse:
    """Train and metric-gate a persisted heatmap forecast bundle."""
    _require_token(x_internal_token)
    result = train_and_maybe_promote(
        [row.model_dump() for row in payload.rows],
        data_source=payload.data_source,
        min_samples=payload.min_samples,
        min_log_likelihood_delta=payload.min_log_likelihood_delta,
    )
    return HeatmapTrainResponse(
        promoted=result.promoted,
        reason=result.reason,
        artefact_path=result.artefact_path,
        metrics=result.metrics,
        previous_metrics=result.previous_metrics,
        trained_at=result.trained_at,
        n_samples=result.n_samples,
        bandwidth=result.bandwidth,
    )


@router.post("/train/vision", response_model=VisionTrainResponse)
def train_vision_endpoint(
    payload: VisionTrainRequest,
    x_internal_token: str | None = Header(default=None),
) -> VisionTrainResponse:
    """Run gated YOLO candidate training against an exported dataset."""
    _require_token(x_internal_token)
    data_yaml = Path(payload.data_yaml)
    if not data_yaml.exists():
        raise HTTPException(status_code=400, detail=f"data_yaml does not exist: {data_yaml}")

    script_path = Path(__file__).resolve().parent.parent / "models" / "computer_vision" / "train_vehicle_damage.py"
    command = [
        sys.executable,
        str(script_path),
        "--data-yaml",
        str(data_yaml),
        "--epochs",
        str(payload.epochs),
        "--imgsz",
        str(payload.imgsz),
        "--batch",
        str(payload.batch),
        "--model",
        payload.model,
        "--min-map-delta",
        str(payload.min_map_delta),
    ]
    if payload.promote:
        command.append("--promote")
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=payload.timeout_seconds,
        cwd=str(script_path.parent),
        check=False,
    )
    manifest = None
    for line in completed.stdout.splitlines():
        if line.startswith("Manifest:"):
            manifest_path = Path(line.split("Manifest:", 1)[1].strip())
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text())
            break
    return VisionTrainResponse(
        returncode=completed.returncode,
        manifest=manifest,
        stdout=completed.stdout[-4000:],
        stderr=completed.stderr[-4000:],
    )
