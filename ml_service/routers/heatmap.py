"""Spatial demand heat map router (KDE).

Stage 1: 2D Gaussian KDE on supplied lat/lng points, returning a grid of
intensities suitable for rendering as a heatmap on the mobile map view.
"""

from __future__ import annotations

from typing import List

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field
from scipy.stats import gaussian_kde

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


@router.post("/heatmap", response_model=HeatmapResponse)
def compute_heatmap(payload: HeatmapRequest) -> HeatmapResponse:
    if len(payload.points) < 2:
        return HeatmapResponse(cells=[], bounds={})

    lats = np.array([p.latitude for p in payload.points])
    lngs = np.array([p.longitude for p in payload.points])
    weights = np.array([p.weight for p in payload.points])

    pad = 0.005
    lat_min, lat_max = lats.min() - pad, lats.max() + pad
    lng_min, lng_max = lngs.min() - pad, lngs.max() + pad

    xs = np.linspace(lng_min, lng_max, payload.grid_size)
    ys = np.linspace(lat_min, lat_max, payload.grid_size)
    xx, yy = np.meshgrid(xs, ys)

    kde = gaussian_kde(
        np.vstack([lngs, lats]),
        weights=weights,
        bw_method=payload.bandwidth,
    )
    z = kde(np.vstack([xx.ravel(), yy.ravel()])).reshape(xx.shape)
    z = z / z.max() if z.max() > 0 else z

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
    return HeatmapResponse(cells=cells, bounds=bounds)
