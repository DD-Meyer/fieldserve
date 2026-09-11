from datetime import date as date_cls
from datetime import datetime

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from businesses.models import Business, Service
from inspections.models import walkaround_progress
from inspections.serializers import validate_inspection_image
from users.models import Customer
from users.permissions import (
    IsBusinessMember,
    active_admin_business_ids,
    active_business_ids,
    active_staff_business_ids,
    is_active_admin,
)

from . import scheduler
from .models import Job, JobIndemnity
from .scheduling_utils import check_slot
from .serializers import JobSerializer


ALLOWED_TRANSITIONS = {
    Job.Status.PENDING: {Job.Status.SCHEDULED, Job.Status.CANCELLED},
    Job.Status.SCHEDULED: {Job.Status.IN_PROGRESS, Job.Status.CANCELLED},
    Job.Status.IN_PROGRESS: {Job.Status.COMPLETED, Job.Status.CANCELLED},
    Job.Status.COMPLETED: set(),
    Job.Status.CANCELLED: set(),
}


def _parse_date(value: str) -> date_cls | None:
    if not value:
        return None
    if value.lower() == "today":
        return timezone.localdate()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]
    search_fields = ["service_type", "notes", "customer__full_name"]
    ordering_fields = ["scheduled_at", "created_at", "status", "price"]
    filterset_fields = ["business", "status", "customer"]

    def get_queryset(self):
        admin_business_ids = active_admin_business_ids(self.request.user)
        staff_business_ids = active_staff_business_ids(self.request.user)
        qs = (
            Job.objects.select_related("business", "customer", "assigned_to")
            .prefetch_related("inspections")
            .filter(business_id__in=admin_business_ids)
            | Job.objects.select_related("business", "customer", "assigned_to")
            .prefetch_related("inspections")
            .filter(
                business_id__in=staff_business_ids,
                assigned_to=self.request.user,
            )
        )
        params = self.request.query_params

        target_date = _parse_date(params.get("date", ""))
        if target_date is not None:
            qs = qs.filter(scheduled_at__date=target_date)

        assigned_to = params.get("assigned_to")
        if assigned_to == "me":
            qs = qs.filter(assigned_to=self.request.user)
        elif assigned_to:
            try:
                qs = qs.filter(assigned_to_id=int(assigned_to))
            except ValueError as exc:
                raise ValidationError({"assigned_to": "Use a member ID or 'me'."}) from exc

        return qs

    def perform_create(self, serializer):
        biz_ids = active_business_ids(self.request.user)
        cust = serializer.validated_data.get("customer")
        if cust is not None and cust.business_id not in biz_ids:
            raise PermissionDenied("Customer is not in your business.")
        assigned_to = serializer.validated_data.get("assigned_to")
        business = serializer.validated_data.get("business") or getattr(cust, "business", None)
        is_admin = business is not None and is_active_admin(self.request.user, business.id)
        if assigned_to is not None and assigned_to != self.request.user and not is_admin:
            raise PermissionDenied("Only Admins can assign jobs to others.")
        if assigned_to is None:
            if is_admin:
                raise ValidationError({"assigned_to": "Assign a team member to this booking."})
            # Staff bookings default to the creator so they show up on their own schedule.
            serializer.save(assigned_to=self.request.user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        if "assigned_to" in serializer.validated_data and not is_active_admin(
            self.request.user, serializer.instance.business_id
        ):
            raise PermissionDenied("Only Admins can assign jobs.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        job = self.get_object()
        new_status = request.data.get("status")
        if new_status not in Job.Status.values:
            raise ValidationError({"status": "Unknown status."})
        allowed = ALLOWED_TRANSITIONS.get(job.status, set())
        if new_status not in allowed:
            raise ValidationError(
                {"status": f"Cannot transition from {job.status} to {new_status}."}
            )
        if new_status == Job.Status.IN_PROGRESS:
            _, missing_angles = walkaround_progress(job)
            if missing_angles:
                raise ValidationError(
                    {
                        "status": "Complete the vehicle walkaround before starting the job.",
                        "missing_angles": missing_angles,
                    }
                )
            indemnity = getattr(job, "indemnity", None)
            if indemnity is None or not indemnity.is_signed:
                raise ValidationError(
                    {"status": "Client indemnity signature is required before starting the job."}
                )
        if new_status == Job.Status.COMPLETED:
            _, missing_angles = walkaround_progress(job, "after")
            if missing_angles:
                raise ValidationError(
                    {
                        "status": "Complete the after-service walkaround before completing the job.",
                        "missing_angles": missing_angles,
                    }
                )
        job.status = new_status
        if new_status == Job.Status.COMPLETED:
            job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(JobSerializer(job).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="indemnity/sign")
    def sign_indemnity(self, request, pk=None):
        job = self.get_object()
        _, missing_angles = walkaround_progress(job)
        if missing_angles:
            raise ValidationError(
                {"detail": "Complete the vehicle walkaround before collecting the signature."}
            )
        try:
            indemnity = job.indemnity
        except JobIndemnity.DoesNotExist as exc:
            raise ValidationError({"detail": "No indemnity is attached to this booking."}) from exc
        signed_name = str(request.data.get("signed_name", "")).strip()
        signature = request.FILES.get("signature")
        if not signed_name:
            raise ValidationError({"signed_name": "Client name is required."})
        if signature is None:
            raise ValidationError({"signature": "A signature image is required."})
        validate_inspection_image(signature)
        indemnity.signed_name = signed_name
        indemnity.signature = signature
        indemnity.signed_at = timezone.now()
        indemnity.save(update_fields=["signed_name", "signature", "signed_at"])
        return Response(JobSerializer(job).data)

    @action(detail=False, methods=["post"], url_path="road-route")
    def road_route(self, request):
        points = request.data.get("points") or []
        if not isinstance(points, list) or not 2 <= len(points) <= 25:
            raise ValidationError({"points": "Provide between 2 and 25 route points."})

        coordinates = []
        for point in points:
            try:
                latitude = float(point["latitude"])
                longitude = float(point["longitude"])
            except (KeyError, TypeError, ValueError) as exc:
                raise ValidationError(
                    {"points": "Each point requires numeric latitude and longitude."}
                ) from exc
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                raise ValidationError({"points": "Route coordinates are out of range."})
            coordinates.append(f"{longitude},{latitude}")

        url = (
            f"{settings.ROAD_ROUTER_URL.rstrip('/')}/route/v1/driving/"
            f"{';'.join(coordinates)}"
        )
        try:
            upstream = requests.get(
                url,
                params={"overview": "full", "geometries": "geojson", "steps": "false"},
                timeout=15,
            )
            upstream.raise_for_status()
            payload = upstream.json()
            route = payload["routes"][0]
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            raise ValidationError(
                {"points": "Road routing is temporarily unavailable."}
            ) from exc

        return Response(
            {
                "path": [
                    {"latitude": latitude, "longitude": longitude}
                    for longitude, latitude in route["geometry"]["coordinates"]
                ],
                "distance_km": round(float(route["distance"]) / 1000, 2),
                "duration_minutes": round(float(route["duration"]) / 60),
                "legs": [
                    {
                        "distance_km": round(float(leg["distance"]) / 1000, 2),
                        "duration_minutes": round(float(leg["duration"]) / 60),
                    }
                    for leg in route.get("legs", [])
                ],
            }
        )

    @action(detail=False, methods=["post"], url_path="check-slot")
    def check_slot_action(self, request):
        biz_ids = active_business_ids(request.user)
        data = request.data or {}

        scheduled_raw = data.get("scheduled_at")
        scheduled_at = parse_datetime(scheduled_raw) if scheduled_raw else None
        if scheduled_at is None:
            raise ValidationError({"scheduled_at": "Required ISO datetime."})

        biz_id = data.get("business")
        customer_id = data.get("customer")
        business: Business | None = None
        customer: Customer | None = None
        lat = data.get("latitude")
        lng = data.get("longitude")

        if customer_id:
            customer = Customer.objects.filter(pk=customer_id).first()
            if customer is None or customer.business_id not in biz_ids:
                raise PermissionDenied("Customer not in your business.")
            business = customer.business
            if (lat is None or lng is None) and customer.location is not None:
                lat = customer.location.y
                lng = customer.location.x
        if business is None:
            if not biz_id or int(biz_id) not in biz_ids:
                raise PermissionDenied("Business not accessible.")
            business = Business.objects.get(pk=biz_id)

        duration = int(data.get("duration_minutes") or 30)
        exclude = data.get("exclude_job_id")
        assigned_to_id = data.get("assigned_to")
        assigned_to = None
        if assigned_to_id:
            assigned_to = get_user_model().objects.filter(pk=assigned_to_id).first()
        result = check_slot(
            business=business,
            scheduled_at=scheduled_at,
            duration_minutes=duration,
            lat=float(lat) if lat is not None else None,
            lng=float(lng) if lng is not None else None,
            exclude_job_id=int(exclude) if exclude else None,
            assigned_to=assigned_to,
        )
        return Response(
            {
                "ok": result.ok,
                "reason": result.reason,
                "suggested_slots": result.suggested_slots or [],
            }
        )

    @action(detail=False, methods=["post"], url_path="suggest-slots")
    def suggest_slots_action(self, request):
        """Return ranked booking slot recommendations for a given day.

        Body: `{ date: YYYY-MM-DD, customer: int, service?: int,
                 duration_minutes?: int, exclude_job_id?: int, assigned_to?: int }`
        Response: `{ date, recommendations: [...], other_available: [...] }`
        """
        biz_ids = active_business_ids(request.user)
        data = request.data or {}

        day = parse_date(data.get("date") or "")
        if day is None:
            raise ValidationError({"date": "Required YYYY-MM-DD."})

        customer_id = data.get("customer")
        if not customer_id:
            raise ValidationError({"customer": "Required."})
        customer = Customer.objects.filter(pk=customer_id).first()
        if customer is None or customer.business_id not in biz_ids:
            raise PermissionDenied("Customer not in your business.")
        business = customer.business

        duration = data.get("duration_minutes")
        service_id = data.get("service")
        if service_id and not duration:
            svc = Service.objects.filter(
                pk=service_id, business=business
            ).first()
            if svc is None:
                raise ValidationError({"service": "Unknown service."})
            duration = svc.duration_minutes
        duration = int(duration or 30)

        lat = customer.location.y if customer.location is not None else None
        lng = customer.location.x if customer.location is not None else None

        exclude = data.get("exclude_job_id")
        assigned_to_id = data.get("assigned_to")
        assigned_to = None
        if assigned_to_id:
            assigned_to = get_user_model().objects.filter(pk=assigned_to_id).first()
        result = scheduler.suggest_slots(
            business=business,
            day=day,
            duration_minutes=duration,
            lat=lat,
            lng=lng,
            exclude_job_id=int(exclude) if exclude else None,
            assigned_to=assigned_to,
        )
        return Response(
            {
                "date": result.day.isoformat(),
                "recommendations": [
                    {
                        "start": r.start.isoformat(),
                        "end": r.end.isoformat(),
                        "score": r.score,
                        "label": r.label,
                        "previous_job": (
                            {"id": r.previous_job_id, "travel_minutes": r.travel_before}
                            if r.previous_job_id is not None
                            else None
                        ),
                        "next_job": (
                            {"id": r.next_job_id, "travel_minutes": r.travel_after}
                            if r.next_job_id is not None
                            else None
                        ),
                        "total_travel_minutes": r.travel_before + r.travel_after,
                    }
                    for r in result.recommendations
                ],
                "other_available": [s.isoformat() for s in result.other_available],
            }
        )
