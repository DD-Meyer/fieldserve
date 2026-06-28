"""Admin endpoints for the FieldServe ML service.

These are protected by a shared-secret header ``X-Internal-Token`` because
they retrain and hot-reload models. The token is read from the environment
variable ``ML_INTERNAL_TOKEN``; if the variable is empty or unset, all admin
endpoints are disabled (the dependency raises 503).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, List

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from features.churn import EXT_FEATURES
from routers import churn as churn_router
from training.churn import train_from_csv, train_from_features

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
# /admin/reload  — hot-swap the in-memory model to the latest on-disk artefact
# ---------------------------------------------------------------------------


@router.post("/reload")
def reload_model(x_internal_token: str | None = Header(default=None)) -> dict[str, Any]:
    """Re-read ``models/churn/churn_model.joblib`` and swap the live model."""
    _require_token(x_internal_token)
    return churn_router.reload_bundle()


# ---------------------------------------------------------------------------
# /admin/train  — retrain from data the caller supplies
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


@router.post("/train/from_features", response_model=TrainResponse)
def train_from_features_endpoint(
    payload: TrainFromFeaturesRequest,
    x_internal_token: str | None = Header(default=None),
) -> TrainResponse:
    """Retrain from a JSON list of pre-engineered rows + labels.

    Does *not* auto-reload — call ``POST /admin/reload`` once you've verified
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
