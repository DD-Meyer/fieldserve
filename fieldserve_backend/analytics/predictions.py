"""Prediction endpoints that proxy to the FastAPI ML service.

Both endpoints scope inputs to the caller's businesses; the ML service is
strictly stateless / spatial and never sees identifiers it can't correlate
without the Django tenant filter above.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from jobs.models import Job
from users.models import Customer
from users.permissions import active_business_ids

from .ml_client import MLClient, MLServiceError

log = logging.getLogger(__name__)


def _point_to_latlng(point) -> tuple[float, float] | None:
    """Extract (lat, lng) from a GEOS Point, tolerating None."""
    if point is None:
        return None
    # PostGIS points expose .x = longitude, .y = latitude.
    return (float(point.y), float(point.x))


def _build_demand_zones(
    customers: list[Customer], business_ids: list[int], range_key: str
) -> list[dict[str, Any]]:
    """Group nearby customers into ranked, explainable demand zones."""
    groups: dict[tuple[int, int], list[Customer]] = defaultdict(list)
    for customer in customers:
        latlng = _point_to_latlng(customer.location)
        if latlng is None:
            continue
        lat, lng = latlng
        groups[(round(lat * 100), round(lng * 100))].append(customer)

    if not groups:
        return []

    customer_ids = [customer.id for customer in customers]
    jobs_by_customer: dict[int, list[Job]] = defaultdict(list)
    jobs = Job.objects.filter(
        business_id__in=business_ids, customer_id__in=customer_ids
    ).only(
        "customer_id", "service_type", "status"
    )
    if range_key in {"30d", "90d"}:
        jobs = jobs.filter(
            scheduled_at__gte=timezone.now()
            - timedelta(days=30 if range_key == "30d" else 90)
        )
    elif range_key == "weekends":
        jobs = jobs.filter(scheduled_at__week_day__in=[1, 7])
    for job in jobs:
        if job.status != Job.Status.CANCELLED:
            jobs_by_customer[job.customer_id].append(job)

    ranked = sorted(
        groups.items(),
        key=lambda item: sum(len(jobs_by_customer[c.id]) for c in item[1]),
        reverse=True,
    )
    total_bookings = max(1, sum(len(jobs_by_customer[c.id]) for c in customers))
    zones: list[dict[str, Any]] = []
    for rank, ((lat_bucket, lng_bucket), members) in enumerate(ranked[:8], start=1):
        member_jobs = [job for customer in members for job in jobs_by_customer[customer.id]]
        service_counts = Counter(
            job.service_type.strip() for job in member_jobs if job.service_type.strip()
        )
        bookings = len(member_jobs)
        zones.append(
            {
                "id": f"zone-{lat_bucket}-{lng_bucket}",
                "name": f"Demand Zone {rank}",
                "latitude": sum(_point_to_latlng(c.location)[0] for c in members) / len(members),
                "longitude": sum(_point_to_latlng(c.location)[1] for c in members) / len(members),
                "customer_count": len(members),
                "booking_count": bookings,
                "share_pct": round(bookings / total_bookings * 100),
                "density": "high" if bookings >= total_bookings * 0.25 else "medium" if bookings else "low",
                "delta_pct": 0,
                "service_mix": [
                    {"name": name, "bookings": count}
                    for name, count in service_counts.most_common(5)
                ],
                "customer_signal": "Recorded customer locations and booking history",
            }
        )
    return zones


class HeatmapView(APIView):
    """POST /api/analytics/predictions/heatmap/

    Body (optional):
        {"grid_size": 40, "bandwidth": null, "weight_by": "count"|"spend"}

    Aggregates customer locations across the caller's businesses and returns
    the KDE grid produced by the ML service, ready for map rendering.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        biz_ids = active_business_ids(request.user)
        if not biz_ids:
            return Response({"cells": [], "bounds": {}})

        grid_size = int(request.data.get("grid_size", 40))
        bandwidth = request.data.get("bandwidth")
        weight_by = request.data.get("weight_by", "count")
        range_key = request.data.get("range", "all")
        if range_key not in {"all", "30d", "90d", "weekends", "new"}:
            range_key = "all"

        qs = Customer.objects.filter(
            business_id__in=biz_ids, location__isnull=False
        )
        if range_key in {"30d", "90d"}:
            qs = qs.filter(
                jobs__scheduled_at__gte=timezone.now()
                - timedelta(days=30 if range_key == "30d" else 90)
            )
        elif range_key == "weekends":
            qs = qs.filter(jobs__scheduled_at__week_day__in=[1, 7])
        elif range_key == "new":
            qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=90))
        qs = qs.distinct()
        customers = list(qs.only("id", "location"))
        points: list[dict[str, Any]] = []
        for cust in customers:
            latlng = _point_to_latlng(cust.location)
            if latlng is None:
                continue
            lat, lng = latlng
            weight = 1.0
            if weight_by == "spend":
                total = sum(
                    float(j.price or 0)
                    for j in cust.jobs.filter(status=Job.Status.COMPLETED)
                )
                weight = max(total, 0.01)
            points.append({"latitude": lat, "longitude": lng, "weight": weight})

        if len(points) < 2:
            return Response({"cells": [], "bounds": {}, "point_count": len(points), "zones": []})

        try:
            body = MLClient().heatmap(
                points, grid_size=grid_size, bandwidth=bandwidth
            )
        except MLServiceError as exc:
            log.warning("Heatmap ML call failed: %s", exc)
            return Response(
                {"detail": "ML service unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        body["point_count"] = len(points)
        body["zones"] = _build_demand_zones(customers, biz_ids, range_key)
        return Response(body)


class ScheduleView(APIView):
    """POST /api/analytics/predictions/schedule/

    Body:
        {
          "depot": {"latitude": ..., "longitude": ...},
          "job_ids": [1,2,3],           # optional; defaults to today's pending+scheduled
          "average_speed_kmh": 40
        }

    Returns the nearest-neighbour route plan from the ML service.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        biz_ids = active_business_ids(request.user)
        if not biz_ids:
            return Response({"stops": [], "total_distance_km": 0.0})

        depot = request.data.get("depot") or {}
        try:
            depot_lat = float(depot["latitude"])
            depot_lng = float(depot["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response(
                {"detail": "depot.latitude and depot.longitude are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        avg_speed = float(request.data.get("average_speed_kmh", 40.0))
        raw_ids = request.data.get("job_ids") or []
        qs = Job.objects.filter(
            business_id__in=biz_ids, location__isnull=False
        )
        if raw_ids:
            qs = qs.filter(id__in=raw_ids)
        else:
            qs = qs.filter(status__in=[Job.Status.PENDING, Job.Status.SCHEDULED])

        jobs_payload: list[dict[str, Any]] = []
        for j in qs.only("id", "location", "service_type"):
            latlng = _point_to_latlng(j.location)
            if latlng is None:
                continue
            jobs_payload.append(
                {
                    "job_id": j.id,
                    "latitude": latlng[0],
                    "longitude": latlng[1],
                    "service_type": j.service_type,
                }
            )

        if not jobs_payload:
            return Response(
                {"stops": [], "total_distance_km": 0.0, "total_travel_minutes": 0.0}
            )

        try:
            body = MLClient().optimise_schedule(
                (depot_lat, depot_lng), jobs_payload, average_speed_kmh=avg_speed
            )
        except MLServiceError as exc:
            log.warning("Schedule ML call failed: %s", exc)
            return Response(
                {"detail": "ML service unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(body)
