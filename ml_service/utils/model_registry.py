"""Model registry — loads the churn model bundle from disk.

The training notebook saves a dict with these keys::

    {
        "model":             <sklearn Pipeline>,
        "imputer":           <sklearn SimpleImputer>,
        "feature_names":     <list[str]>,         # column order used during fit
        "model_name":        "Logistic Regression" | "Random Forest" | "XGBoost",
        "feature_set_label": "RFM only (baseline)" | "Extended features",
        "data_source":       "UCI Online Retail II",
        "metrics":           {"pr_auc", "roc_auc", "f1", "brier_score"},
        "risk_bucket_thresholds": {"high": 0.65, "medium": 0.35},
        "churn_definition":  {...},
        "trained_at":        "ISO timestamp",
    }

Older notebook versions saved a bare ``Pipeline`` — for those we wrap into the
same shape with placeholder metadata and ``feature_names=None`` so the router
can fall back to the RFM heuristic without crashing.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib

log = logging.getLogger(__name__)

# Absolute paths so the loader works no matter where uvicorn is launched from.
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CHURN_DIR = MODELS_DIR / "churn"

# Preferred filename (new bundle format) first; legacy filename second.
CHURN_CANDIDATES: list[str] = [
    "churn_model.joblib",
    "churn_pred_model.joblib",
]


class ModelNotFoundError(RuntimeError):
    """Raised when no churn artefact can be located on disk."""


def _wrap_legacy(obj: Any, path: Path) -> dict[str, Any]:
    """Adapt a bare sklearn Pipeline to the bundle shape used by the rest of the code."""
    return {
        "model": obj,
        "imputer": None,
        "feature_names": None,  # unknown — caller must treat as legacy
        "model_name": "legacy",
        "feature_set_label": "unknown",
        "data_source": "unknown",
        "metrics": {},
        "risk_bucket_thresholds": {"high": 0.65, "medium": 0.35},
        "churn_definition": {},
        "trained_at": "unknown",
        "_artefact_path": str(path),
        "_legacy": True,
    }


def load_churn_bundle() -> dict[str, Any]:
    """Load the latest churn bundle from `ml_service/models/churn/`.

    Returns a dict in the bundle shape described in the module docstring. Always
    includes a synthetic ``_artefact_path`` and ``_legacy`` key for diagnostics.

    Raises:
        ModelNotFoundError: if no candidate file exists.
    """
    # Look in the per-feature subfolder first, then in the top-level models/
    # directory for backwards compatibility.
    search_dirs = [CHURN_DIR, MODELS_DIR]
    for directory in search_dirs:
        for name in CHURN_CANDIDATES:
            path = directory / name
            if not path.exists():
                continue

            obj = joblib.load(path)

            if isinstance(obj, dict) and "model" in obj:
                obj.setdefault("_artefact_path", str(path))
                obj.setdefault("_legacy", False)
                log.info(
                    "Loaded churn bundle from %s (model=%s, features=%s)",
                    path,
                    obj.get("model_name"),
                    len(obj.get("feature_names") or []),
                )
                return obj

            log.warning(
                "Loaded legacy bare-pipeline artefact at %s; feature names are "
                "unknown so the router will fall back to the RFM heuristic. "
                "Re-run the training notebook to upgrade to the bundle format.",
                path,
            )
            return _wrap_legacy(obj, path)

    raise ModelNotFoundError(
        f"No churn model artefact found in {CHURN_DIR} or {MODELS_DIR}. "
        f"Expected one of: {CHURN_CANDIDATES}. "
        f"Run the training notebook's export cell."
    )
