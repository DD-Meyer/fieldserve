"""Scheduling optimisation router.

Stage 1: nearest-neighbour route ordering + naive duration estimate.
OR-Tools CVRP/VRPTW will replace `_nearest_neighbour` once installed.
"""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["scheduling"])


class SchedulingJob(BaseModel):
    job_id: int
    latitude: float
    longitude: float
    service_type: str | None = None


class SchedulingRequest(BaseModel):
    depot_latitude: float
    depot_longitude: float
    jobs: List[SchedulingJob]
    average_speed_kmh: float = Field(40.0, gt=0)


class RouteStop(BaseModel):
    job_id: int
    order: int
    distance_km: float
    travel_minutes: float


class SchedulingResponse(BaseModel):
    total_distance_km: float
    total_travel_minutes: float
    stops: List[RouteStop]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlam = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlam / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _nearest_neighbour(req: SchedulingRequest) -> SchedulingResponse:
    remaining = list(req.jobs)
    cur_lat, cur_lng = req.depot_latitude, req.depot_longitude
    stops: list[RouteStop] = []
    total_km = 0.0

    order = 1
    while remaining:
        idx, dist = min(
            ((i, _haversine_km(cur_lat, cur_lng, j.latitude, j.longitude)) for i, j in enumerate(remaining)),
            key=lambda x: x[1],
        )
        job = remaining.pop(idx)
        travel_min = (dist / req.average_speed_kmh) * 60
        stops.append(RouteStop(job_id=job.job_id, order=order, distance_km=round(dist, 3), travel_minutes=round(travel_min, 1)))
        total_km += dist
        cur_lat, cur_lng = job.latitude, job.longitude
        order += 1

    return SchedulingResponse(
        total_distance_km=round(total_km, 3),
        total_travel_minutes=round((total_km / req.average_speed_kmh) * 60, 1),
        stops=stops,
    )


@router.post("/schedule", response_model=SchedulingResponse)
def optimise_schedule(payload: SchedulingRequest) -> SchedulingResponse:
    return _nearest_neighbour(payload)
