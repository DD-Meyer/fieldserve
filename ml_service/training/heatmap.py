"""Train and serve persisted demand-forecast heatmap bundles.

The request-time heatmap endpoint still fits KDE from supplied points. This
module adds a promoted artefact for forward-looking demand zones trained from
historical customer/job locations.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KernelDensity

ML_SERVICE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_BUNDLE_PATH = ML_SERVICE_DIR / "models" / "heatmap" / "heatmap_model.joblib"
DEFAULT_BANDWIDTHS = tuple(float(v) for v in np.linspace(0.002, 0.03, 8))
RANDOM_STATE = 42


@dataclass(frozen=True)
class HeatmapTrainingResult:
    promoted: bool
    reason: str
    artefact_path: str
    metrics: dict[str, float]
    trained_at: str
    n_samples: int
    bandwidth: float
    previous_metrics: dict[str, float]


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _prepare_rows(rows: list[dict[str, Any]]) -> tuple[np.ndarray, np.ndarray, list[datetime | None]]:
    coords: list[list[float]] = []
    weights: list[float] = []
    observed_at: list[datetime | None] = []
    for row in rows:
        try:
            lat = float(row["latitude"])
            lng = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if not np.isfinite(lat) or not np.isfinite(lng):
            continue
        weight = row.get("weight", 1.0)
        try:
            weight_float = max(float(weight), 0.01)
        except (TypeError, ValueError):
            weight_float = 1.0
        coords.append([lng, lat])
        weights.append(weight_float)
        observed_at.append(_parse_datetime(row.get("observed_at")))
    if not coords:
        return np.empty((0, 2), dtype=float), np.empty((0,), dtype=float), []
    return np.asarray(coords, dtype=float), np.asarray(weights, dtype=float), observed_at


def _time_decay_weights(base_weights: np.ndarray, observed_at: list[datetime | None]) -> np.ndarray:
    if not observed_at or all(value is None for value in observed_at):
        return base_weights
    latest = max(value for value in observed_at if value is not None)
    decayed = base_weights.copy()
    for index, value in enumerate(observed_at):
        if value is None:
            continue
        age_days = max((latest - value).days, 0)
        decayed[index] *= 0.5 ** (age_days / 180.0)
    return decayed


def _temporal_split(
    coords: np.ndarray,
    weights: np.ndarray,
    observed_at: list[datetime | None],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    if len(coords) < 10:
        return coords, coords, weights, weights
    if observed_at and any(value is not None for value in observed_at):
        order = np.argsort([value.timestamp() if value else 0.0 for value in observed_at])
    else:
        rng = np.random.default_rng(RANDOM_STATE)
        order = rng.permutation(len(coords))
    split_at = max(2, int(len(coords) * 0.8))
    train_index = order[:split_at]
    validation_index = order[split_at:]
    if len(validation_index) < 2:
        validation_index = train_index
    return coords[train_index], coords[validation_index], weights[train_index], weights[validation_index]


def _fit_kde(coords: np.ndarray, weights: np.ndarray, bandwidth: float | None = None) -> KernelDensity:
    model = KernelDensity(kernel="gaussian", bandwidth=bandwidth or 0.01)
    try:
        model.fit(coords, sample_weight=weights)
    except TypeError:
        model.fit(coords)
    return model


def _select_bandwidth(coords: np.ndarray, weights: np.ndarray) -> float:
    if len(coords) < 5:
        return 0.01
    cv = min(5, len(coords))
    grid = GridSearchCV(
        KernelDensity(kernel="gaussian"),
        {"bandwidth": list(DEFAULT_BANDWIDTHS)},
        cv=cv,
    )
    try:
        grid.fit(coords, sample_weight=weights)
    except TypeError:
        grid.fit(coords)
    return float(grid.best_params_["bandwidth"])


def _score_per_point(model: KernelDensity, coords: np.ndarray) -> float:
    if len(coords) == 0:
        return float("-inf")
    return float(model.score(coords) / len(coords))


def load_bundle(path: Path | None = None) -> dict[str, Any] | None:
    bundle_path = path or DEFAULT_BUNDLE_PATH
    if not bundle_path.exists():
        return None
    return joblib.load(bundle_path)


def train_and_maybe_promote(
    rows: list[dict[str, Any]],
    *,
    data_source: str = "django-analytics",
    min_samples: int = 20,
    min_log_likelihood_delta: float = 0.0,
    save_path: Path | None = None,
) -> HeatmapTrainingResult:
    coords, base_weights, observed_at = _prepare_rows(rows)
    if len(coords) < min_samples:
        return HeatmapTrainingResult(
            promoted=False,
            reason=f"Only {len(coords)} valid point(s); need >= {min_samples}.",
            artefact_path=str(save_path or DEFAULT_BUNDLE_PATH),
            metrics={"validation_log_likelihood": float("-inf")},
            trained_at=datetime.now(timezone.utc).isoformat(),
            n_samples=len(coords),
            bandwidth=0.0,
            previous_metrics={},
        )

    weights = _time_decay_weights(base_weights, observed_at)
    train_coords, validation_coords, train_weights, _ = _temporal_split(coords, weights, observed_at)
    bandwidth = _select_bandwidth(train_coords, train_weights)
    validation_model = _fit_kde(train_coords, train_weights, bandwidth)
    candidate_score = _score_per_point(validation_model, validation_coords)

    existing = load_bundle(save_path)
    previous_metrics: dict[str, float] = {}
    previous_score = float("-inf")
    if existing is not None and "model" in existing:
        previous_score = _score_per_point(existing["model"], validation_coords)
        previous_metrics = {"validation_log_likelihood": previous_score}

    delta = candidate_score - previous_score
    promoted = existing is None or delta >= min_log_likelihood_delta
    reason = "promoted" if promoted else (
        f"Candidate log-likelihood delta {delta:.4f} below required {min_log_likelihood_delta:.4f}."
    )
    trained_at = datetime.now(timezone.utc).isoformat()
    metrics = {
        "validation_log_likelihood": float(round(candidate_score, 6)),
        "previous_validation_log_likelihood": float(round(previous_score, 6)) if np.isfinite(previous_score) else previous_score,
        "log_likelihood_delta": float(round(delta, 6)) if np.isfinite(delta) else delta,
        "validation_points": float(len(validation_coords)),
    }

    artefact_path = save_path or DEFAULT_BUNDLE_PATH
    if promoted:
        final_model = _fit_kde(coords, weights, bandwidth)
        bundle = {
            "model": final_model,
            "model_name": "KernelDensity",
            "feature_names": ["longitude", "latitude"],
            "bandwidth": bandwidth,
            "metrics": metrics,
            "data_source": data_source,
            "trained_at": trained_at,
            "n_samples": int(len(coords)),
            "bounds": {
                "lng_min": float(coords[:, 0].min()),
                "lng_max": float(coords[:, 0].max()),
                "lat_min": float(coords[:, 1].min()),
                "lat_max": float(coords[:, 1].max()),
            },
            "promotion_decision": reason,
        }
        artefact_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = artefact_path.with_suffix(artefact_path.suffix + ".tmp")
        joblib.dump(bundle, tmp)
        tmp.replace(artefact_path)

    return HeatmapTrainingResult(
        promoted=promoted,
        reason=reason,
        artefact_path=str(artefact_path),
        metrics=metrics,
        trained_at=trained_at,
        n_samples=int(len(coords)),
        bandwidth=bandwidth,
        previous_metrics=previous_metrics,
    )


def forecast_grid(
    *,
    grid_size: int = 40,
    horizon_days: int = 30,
    min_intensity: float = 0.05,
) -> dict[str, Any]:
    bundle = load_bundle()
    if bundle is None:
        raise FileNotFoundError(f"No heatmap forecast bundle found at {DEFAULT_BUNDLE_PATH}")
    bounds = dict(bundle["bounds"])
    pad = 0.005
    xs = np.linspace(bounds["lng_min"] - pad, bounds["lng_max"] + pad, grid_size)
    ys = np.linspace(bounds["lat_min"] - pad, bounds["lat_max"] + pad, grid_size)
    xx, yy = np.meshgrid(xs, ys)
    coords = np.vstack([xx.ravel(), yy.ravel()]).T
    scores = np.exp(bundle["model"].score_samples(coords)).reshape(xx.shape)
    scores = scores / scores.max() if np.isfinite(scores).all() and scores.max() > 0 else scores
    cells = [
        {"latitude": float(yy[i, j]), "longitude": float(xx[i, j]), "intensity": float(scores[i, j])}
        for i in range(grid_size)
        for j in range(grid_size)
        if scores[i, j] > min_intensity
    ]
    ranked = sorted(cells, key=lambda cell: cell["intensity"], reverse=True)[:8]
    zones = [
        {
            "id": f"forecast-zone-{index}",
            "name": f"Opportunity Zone {index}",
            "latitude": cell["latitude"],
            "longitude": cell["longitude"],
            "opportunity_score": round(cell["intensity"], 4),
            "estimated_demand_share": round(cell["intensity"] / max(sum(item["intensity"] for item in ranked), 1e-9), 4),
            "confidence_band": "high" if cell["intensity"] >= 0.75 else "medium" if cell["intensity"] >= 0.4 else "low",
        }
        for index, cell in enumerate(ranked, start=1)
    ]
    return {
        "cells": cells,
        "bounds": {
            "lat_min": bounds["lat_min"] - pad,
            "lat_max": bounds["lat_max"] + pad,
            "lng_min": bounds["lng_min"] - pad,
            "lng_max": bounds["lng_max"] + pad,
        },
        "computation_mode": "forecast_kde_bundle",
        "input_point_count": int(bundle["n_samples"]),
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "forecast_horizon_days": horizon_days,
        "model_version": bundle["trained_at"],
        "metrics": bundle.get("metrics", {}),
        "opportunity_zones": zones,
    }