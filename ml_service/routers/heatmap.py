"""Spatial demand heat map router (KDE).

Stage 1: 2D Gaussian KDE on supplied lat/lng points, returning a grid of
intensities suitable for rendering as a heatmap on the mobile map view.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field
from scipy.stats import gaussian_kde

from training.heatmap import forecast_grid


def _stabilize_kde_input(points: np.ndarray) -> np.ndarray:
    """Regularize degenerate 2D input so KDE stays numerically stable.

    Small or line-like clusters produce singular covariance matrices in SciPy's
    Gaussian KDE. A tiny, deterministic jitter keeps the covariance full-rank
    without materially changing the hotspot geometry.
    """
    if points.size == 0 or points.shape[1] == 0:
        return points

    covariance = np.cov(points, rowvar=False)
    if np.isscalar(covariance):
        covariance = np.array([[float(covariance)]])
    covariance = np.asarray(covariance, dtype=float)
    covariance = np.nan_to_num(covariance, nan=0.0, posinf=0.0, neginf=0.0)

    if covariance.size == 1:
        covariance = np.array([[covariance.item(), 0.0], [0.0, 1.0]])

    if np.linalg.matrix_rank(covariance) >= 2 and len(points) >= 3:
        return points

    spread = np.ptp(points, axis=0)
    base_scale = np.maximum(spread, 1e-6)
    rng = np.random.default_rng(0)
    jitter = rng.normal(0.0, base_scale * 1e-6, size=points.shape)
    return points + jitter

router = APIRouter(tags=["heatmap"])


class GeoPoint(BaseModel):
    latitude: float
    longitude: float
    weight: float = 1.0


class HeatmapRequest(BaseModel):
    points: List[GeoPoint]
    grid_size: int = Field(40, ge=8, le=200)
    bandwidth: float | None = None


class HeatmapCell(BaseModel):
    latitude: float
    longitude: float
    intensity: float


class HeatmapResponse(BaseModel):
    cells: List[HeatmapCell]
    bounds: dict
    computation_mode: str = "live_request_kde"
    input_point_count: int
    computed_at: datetime


class HeatmapForecastRequest(BaseModel):
    grid_size: int = Field(40, ge=8, le=200)
    forecast_horizon_days: int = Field(30, ge=1, le=365)


@router.post("/heatmap", response_model=HeatmapResponse)
def compute_heatmap(payload: HeatmapRequest) -> HeatmapResponse:
    computed_at = datetime.now(timezone.utc)
    if len(payload.points) < 2:
        return HeatmapResponse(
            cells=[],
            bounds={},
            input_point_count=len(payload.points),
            computed_at=computed_at,
        )

    lats = np.array([p.latitude for p in payload.points], dtype=float)
    lngs = np.array([p.longitude for p in payload.points], dtype=float)
    weights = np.array([p.weight for p in payload.points], dtype=float)

    data = np.vstack([lngs, lats]).T
    data = _stabilize_kde_input(data)
    lngs = data[:, 0]
    lats = data[:, 1]

    pad = 0.005
    lat_min, lat_max = lats.min() - pad, lats.max() + pad
    lng_min, lng_max = lngs.min() - pad, lngs.max() + pad

    xs = np.linspace(lng_min, lng_max, payload.grid_size)
    ys = np.linspace(lat_min, lat_max, payload.grid_size)
    xx, yy = np.meshgrid(xs, ys)

    kde = gaussian_kde(
        data.T,
        weights=weights,
        bw_method=payload.bandwidth,
    )
    z = kde(np.vstack([xx.ravel(), yy.ravel()])).reshape(xx.shape)
    z = z / z.max() if np.isfinite(z).all() and z.max() > 0 else z

    cells = [
        HeatmapCell(latitude=float(yy[i, j]), longitude=float(xx[i, j]), intensity=float(z[i, j]))
        for i in range(payload.grid_size)
        for j in range(payload.grid_size)
        if z[i, j] > 0.05
    ]
    bounds = {
        "lat_min": lat_min,
        "lat_max": lat_max,
        "lng_min": lng_min,
        "lng_max": lng_max,
    }
    return HeatmapResponse(
        cells=cells,
        bounds=bounds,
        input_point_count=len(payload.points),
        computed_at=computed_at,
    )


@router.post("/heatmap/forecast")
def compute_heatmap_forecast(payload: HeatmapForecastRequest) -> dict:
    """Serve a promoted forecast bundle as future demand opportunity zones."""
    return forecast_grid(
        grid_size=payload.grid_size,
        horizon_days=payload.forecast_horizon_days,
    )
