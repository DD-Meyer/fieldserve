"""Customer churn prediction router.

Production path: loads the bundled sklearn `Pipeline` + matched `SimpleImputer`
saved by `ml_service/models/01_churn (1).ipynb` and predicts using the 17 named
features defined in `features.churn.EXT_FEATURES`.

Fallback path: if no bundle is on disk (or only a legacy bare-pipeline artefact
is present), the router serves an RFM-quintile heuristic instead so Swagger
still works. The fallback is logged loudly at startup.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, List

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field

from features.churn import EXT_FEATURES, FEATURE_DESCRIPTIONS
from utils.model_registry import ModelNotFoundError, load_churn_bundle

log = logging.getLogger(__name__)
router = APIRouter(tags=["churn"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class CustomerFeatures(BaseModel):
    """One customer's pre-computed features.

    All feature fields are optional; missing values are filled by the imputer
    saved inside the model bundle (median of the training set per column).
    """

    customer_id: int
    recency_days: float | None = Field(None, description=FEATURE_DESCRIPTIONS["recency_days"])
    tenure_days: float | None = Field(None, description=FEATURE_DESCRIPTIONS["tenure_days"])
    freq_12m: float | None = Field(None, description=FEATURE_DESCRIPTIONS["freq_12m"])
    freq_3m: float | None = Field(None, description=FEATURE_DESCRIPTIONS["freq_3m"])
    avg_inter_booking_gap: float | None = Field(None, description=FEATURE_DESCRIPTIONS["avg_inter_booking_gap"])
    inter_booking_gap_std: float | None = Field(None, description=FEATURE_DESCRIPTIONS["inter_booking_gap_std"])
    total_spend_12m: float | None = Field(None, description=FEATURE_DESCRIPTIONS["total_spend_12m"])
    avg_ticket: float | None = Field(None, description=FEATURE_DESCRIPTIONS["avg_ticket"])
    monetary_trend: float | None = Field(None, description=FEATURE_DESCRIPTIONS["monetary_trend"])
    spend_per_visit_std: float | None = Field(None, description=FEATURE_DESCRIPTIONS["spend_per_visit_std"])
    spend_per_visit_cv: float | None = Field(None, description=FEATURE_DESCRIPTIONS["spend_per_visit_cv"])
    cancellation_rate: float | None = Field(None, description=FEATURE_DESCRIPTIONS["cancellation_rate"])
    unique_item_types: float | None = Field(None, description=FEATURE_DESCRIPTIONS["unique_item_types"])
    total_units: float | None = Field(None, description=FEATURE_DESCRIPTIONS["total_units"])
    weekend_share: float | None = Field(None, description=FEATURE_DESCRIPTIONS["weekend_share"])
    evening_share: float | None = Field(None, description=FEATURE_DESCRIPTIONS["evening_share"])
    is_uk: float | None = Field(None, description=FEATURE_DESCRIPTIONS["is_uk"])

    # Optional RFM-shaped fields, only used by the fallback heuristic.
    last_job_at: datetime | None = None
    job_count: int | None = Field(None, ge=0)
    total_spend: float | None = Field(None, ge=0.0)


class ChurnRequest(BaseModel):
    as_of: datetime | None = None
    customers: List[CustomerFeatures]

    model_config = {
        "json_schema_extra": {
            "example": {
                "as_of": "2026-06-27T00:00:00Z",
                "customers": [
                    {
                        "customer_id": 1,
                        "recency_days": 14, "tenure_days": 420,
                        "freq_12m": 9, "freq_3m": 3,
                        "avg_inter_booking_gap": 30.0, "inter_booking_gap_std": 8.5,
                        "total_spend_12m": 720.0, "avg_ticket": 80.0,
                        "monetary_trend": 2.5,
                        "spend_per_visit_std": 12.0, "spend_per_visit_cv": 0.15,
                        "cancellation_rate": 0.0,
                        "unique_item_types": 2.0, "total_units": 18,
                        "weekend_share": 0.22, "evening_share": 0.11,
                        "is_uk": 1,
                    },
                    {
                        "customer_id": 2,
                        "recency_days": 180, "tenure_days": 600,
                        "freq_12m": 2, "freq_3m": 0,
                        "avg_inter_booking_gap": 200.0, "inter_booking_gap_std": 60.0,
                        "total_spend_12m": 140.0, "avg_ticket": 70.0,
                        "monetary_trend": -3.0,
                        "spend_per_visit_std": 5.0, "spend_per_visit_cv": 0.07,
                        "cancellation_rate": 0.5,
                        "unique_item_types": 1.0, "total_units": 3,
                        "weekend_share": 0.0, "evening_share": 0.0,
                        "is_uk": 1,
                    },
                ],
            }
        }
    }


class ChurnPrediction(BaseModel):
    customer_id: int
    probability: float
    risk_bucket: str
    recency_days: int | None = None
    rfm_score: int | None = None  # populated only by the fallback heuristic


class ChurnResponse(BaseModel):
    as_of: datetime
    model_version: str
    model_name: str
    feature_set: str
    predictions: List[ChurnPrediction]


# ---------------------------------------------------------------------------
# Bundle loading (once at import)
# ---------------------------------------------------------------------------


def _safe_load_bundle() -> dict[str, Any] | None:
    try:
        return load_churn_bundle()
    except ModelNotFoundError as exc:
        log.warning("Churn bundle not loaded: %s — falling back to RFM heuristic.", exc)
        return None


_BUNDLE: dict[str, Any] | None = _safe_load_bundle()
_USE_MODEL: bool = bool(
    _BUNDLE
    and not _BUNDLE.get("_legacy", False)
    and _BUNDLE.get("feature_names")
)

if _USE_MODEL:
    _MODEL_FEATURES: list[str] = list(_BUNDLE["feature_names"])  # type: ignore[index]
    log.info(
        "Churn router using bundled model (%s / %s, %d features).",
        _BUNDLE["model_name"],  # type: ignore[index]
        _BUNDLE["feature_set_label"],  # type: ignore[index]
        len(_MODEL_FEATURES),
    )
else:
    _MODEL_FEATURES = EXT_FEATURES  # only used to keep type checkers happy
    log.warning(
        "Churn router falling back to RFM heuristic. Re-run the training "
        "notebook's export cell to produce models/churn_model.joblib."
    )


def _risk_bucket(p: float, thresholds: dict[str, float] | None = None) -> str:
    th = thresholds or (_BUNDLE or {}).get("risk_bucket_thresholds") or {"high": 0.65, "medium": 0.35}
    if p >= th["high"]:
        return "High"
    if p >= th["medium"]:
        return "Medium"
    return "Low"


# ---------------------------------------------------------------------------
# Production path: predict with the bundled pipeline
# ---------------------------------------------------------------------------


def _predict_with_model(req: ChurnRequest) -> ChurnResponse:
    assert _BUNDLE is not None  # narrowed by _USE_MODEL

    as_of = req.as_of or datetime.now(timezone.utc)
    if not req.customers:
        return ChurnResponse(
            as_of=as_of,
            model_version=_BUNDLE.get("trained_at", "unknown"),
            model_name=_BUNDLE.get("model_name", "unknown"),
            feature_set=_BUNDLE.get("feature_set_label", "unknown"),
            predictions=[],
        )

    # Build a DataFrame in the exact column order the model expects, then
    # pass .values so it matches how the Pipeline was fit (numpy, not named).
    rows = [c.model_dump() for c in req.customers]
    df = pd.DataFrame(rows)
    for col in _MODEL_FEATURES:
        if col not in df.columns:
            df[col] = np.nan
    X = df[_MODEL_FEATURES].astype(float).values

    imputer = _BUNDLE.get("imputer")
    if imputer is not None:
        X = imputer.transform(X)

    model = _BUNDLE["model"]
    probs = model.predict_proba(X)[:, 1]

    thresholds = _BUNDLE.get("risk_bucket_thresholds")
    predictions = [
        ChurnPrediction(
            customer_id=c.customer_id,
            probability=float(round(probs[i], 4)),
            risk_bucket=_risk_bucket(float(probs[i]), thresholds),
            recency_days=int(c.recency_days) if c.recency_days is not None else None,
        )
        for i, c in enumerate(req.customers)
    ]

    return ChurnResponse(
        as_of=as_of,
        model_version=_BUNDLE.get("trained_at", "unknown"),
        model_name=_BUNDLE.get("model_name", "unknown"),
        feature_set=_BUNDLE.get("feature_set_label", "unknown"),
        predictions=predictions,
    )


# ---------------------------------------------------------------------------
# Fallback path: RFM-quintile heuristic
# ---------------------------------------------------------------------------


def _quintile_rank(values: np.ndarray, reverse: bool = False) -> np.ndarray:
    if values.size == 0:
        return values.astype(int)
    order = values.argsort()
    ranks = np.empty_like(order)
    ranks[order] = np.arange(values.size)
    bucketed = np.floor(ranks / max(values.size, 1) * 5).astype(int) + 1
    bucketed = np.clip(bucketed, 1, 5)
    return 6 - bucketed if reverse else bucketed


def _score_rfm(req: ChurnRequest) -> ChurnResponse:
    as_of = req.as_of or datetime.now(timezone.utc)
    if not req.customers:
        return ChurnResponse(
            as_of=as_of,
            model_version="heuristic-v1",
            model_name="RFM quintile",
            feature_set="recency/frequency/monetary",
            predictions=[],
        )

    recency = np.array(
        [
            (as_of - c.last_job_at).days if c.last_job_at else (c.recency_days or 365)
            for c in req.customers
        ],
        dtype=float,
    )
    frequency = np.array([float(c.job_count or c.freq_12m or 0) for c in req.customers])
    monetary = np.array([float(c.total_spend or c.total_spend_12m or 0.0) for c in req.customers])

    r_rank = _quintile_rank(recency, reverse=True)
    f_rank = _quintile_rank(frequency)
    m_rank = _quintile_rank(monetary)
    rfm = r_rank + f_rank + m_rank

    prob = 1 - (rfm - 3) / 12
    prob = np.clip(prob, 0.01, 0.99)

    predictions = [
        ChurnPrediction(
            customer_id=c.customer_id,
            probability=float(round(prob[i], 4)),
            risk_bucket=_risk_bucket(float(prob[i])),
            recency_days=int(recency[i]) if c.last_job_at or c.recency_days is not None else None,
            rfm_score=int(rfm[i]),
        )
        for i, c in enumerate(req.customers)
    ]
    return ChurnResponse(
        as_of=as_of,
        model_version="heuristic-v1",
        model_name="RFM quintile",
        feature_set="recency/frequency/monetary",
        predictions=predictions,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/churn", response_model=ChurnResponse)
def predict_churn(payload: ChurnRequest) -> ChurnResponse:
    """Predict churn probability for one or more customers."""
    if _USE_MODEL:
        return _predict_with_model(payload)
    return _score_rfm(payload)


def reload_bundle() -> dict[str, Any]:
    """Re-read the on-disk bundle and swap the live model in place.

    Returns a small status dict describing the new state. Used by the
    `/admin/reload` endpoint and by tests that want to force a refresh.
    """
    global _BUNDLE, _USE_MODEL, _MODEL_FEATURES

    new_bundle = _safe_load_bundle()
    use_model = bool(
        new_bundle
        and not new_bundle.get("_legacy", False)
        and new_bundle.get("feature_names")
    )

    _BUNDLE = new_bundle
    _USE_MODEL = use_model
    _MODEL_FEATURES = list(new_bundle["feature_names"]) if use_model else EXT_FEATURES  # type: ignore[index]

    log.info(
        "Reloaded churn bundle; mode=%s, trained_at=%s",
        "model" if use_model else "fallback",
        (new_bundle or {}).get("trained_at"),
    )
    return {
        "loaded": new_bundle is not None,
        "mode": "model" if use_model else "fallback",
        "trained_at": (new_bundle or {}).get("trained_at"),
        "model_name": (new_bundle or {}).get("model_name"),
        "feature_set_label": (new_bundle or {}).get("feature_set_label"),
        "metrics": (new_bundle or {}).get("metrics"),
    }


@router.get("/churn/info")
def churn_info() -> dict[str, Any]:
    """Diagnostics: which artefact is loaded and what its metadata says."""
    if not _BUNDLE:
        return {
            "loaded": False,
            "mode": "fallback",
            "reason": "no model artefact on disk",
            "expected_features": EXT_FEATURES,
        }
    return {
        "loaded": True,
        "mode": "model" if _USE_MODEL else "fallback",
        "model_name": _BUNDLE.get("model_name"),
        "feature_set_label": _BUNDLE.get("feature_set_label"),
        "data_source": _BUNDLE.get("data_source"),
        "metrics": _BUNDLE.get("metrics"),
        "risk_bucket_thresholds": _BUNDLE.get("risk_bucket_thresholds"),
        "churn_definition": _BUNDLE.get("churn_definition"),
        "trained_at": _BUNDLE.get("trained_at"),
        "feature_names": _BUNDLE.get("feature_names"),
        "artefact_path": _BUNDLE.get("_artefact_path"),
        "legacy": _BUNDLE.get("_legacy", False),
    }
