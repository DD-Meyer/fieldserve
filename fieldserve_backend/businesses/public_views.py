"""Public, no-auth endpoints for the customer-facing booking page.

These are deliberately separate from the authenticated `BusinessViewSet` so
that there's a single, narrow surface area that's exposed without a Clerk JWT.

Endpoints:
- GET  /api/public/businesses/<slug>/           : minimal business profile
- GET  /api/public/businesses/<slug>/services/  : active services
- POST /api/public/businesses/<slug>/bookings/  : create customer + job

Throttled by IP to keep abuse manageable.
"""

from __future__ import annotations

from django.contrib.gis.geos import Point
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from jobs import scheduler
from jobs.indemnity import active_indemnity_for, attach_active_indemnity
from jobs.models import Job
from jobs.scheduling_utils import check_slot
from users.models import Customer

from .models import Business, Service


class _BookingThrottle(AnonRateThrottle):
    rate = "20/hour"


class PublicBusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = (
            "name",
            "trading_name",
            "slug",
            "industry_mode",
            "brand_color",
            "logo_url",
            "address_city",
            "address_country",
            "public_booking_enabled",
        )


class PublicServiceSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = Service
        fields = ("id", "slug", "name", "description", "duration_minutes", "price")


class PublicBookingSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    service_id = serializers.IntegerField()
    scheduled_at = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "Provide at least one of email or phone so we can contact you."
            )
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "Provide both latitude and longitude when selecting an address."
            )
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180."})
        return attrs


def _get_active_business(slug: str) -> Business:
    biz = get_object_or_404(Business, slug=slug)
    if not biz.public_booking_enabled:
        raise serializers.ValidationError(
            "This business is not accepting public bookings."
        )
    return biz


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_business_detail(request, slug: str):
    biz = get_object_or_404(Business, slug=slug)
    return Response(PublicBusinessSerializer(biz).data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_service_list(request, slug: str):
    biz = _get_active_business(slug)
    services = biz.services.filter(is_active=True)
    return Response(PublicServiceSerializer(services, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_booking_create(request, slug: str):
    biz = _get_active_business(slug)
    serializer = PublicBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    if biz.industry_mode == Business.Industry.MOBILE and (
        not (data.get("address") or "").strip()
        or data.get("latitude") is None
        or data.get("longitude") is None
    ):
        raise serializers.ValidationError(
            {
                "location": (
                    "Mobile bookings require an address and selected map location."
                )
            }
        )

    service = get_object_or_404(
        Service, pk=data["service_id"], business=biz, is_active=True
    )
    active_indemnity_for(biz)

    slot = check_slot(
        business=biz,
        scheduled_at=data["scheduled_at"],
        duration_minutes=service.duration_minutes,
        lat=data.get("latitude"),
        lng=data.get("longitude"),
    )
    if not slot.ok:
        return Response(
            {
                "detail": "slot_unavailable",
                "reason": slot.reason,
                "suggested_slots": slot.suggested_slots or [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Find-or-create the customer within this business.
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    location = None
    if data.get("latitude") is not None:
        location = Point(data["longitude"], data["latitude"], srid=4326)
    customer = None
    if email:
        customer = Customer.objects.filter(business=biz, email__iexact=email).first()
    if customer is None and phone:
        customer = Customer.objects.filter(business=biz, phone=phone).first()
    if customer is None:
        customer = Customer.objects.create(
            business=biz,
            full_name=data["full_name"].strip(),
            email=email,
            phone=phone,
            address=(data.get("address") or "").strip(),
            location=location,
        )
    else:
        # Patch in any new contact details the customer provided.
        updates: dict[str, str] = {}
        if data["full_name"].strip() and customer.full_name != data["full_name"].strip():
            updates["full_name"] = data["full_name"].strip()
        if data.get("address") and not customer.address:
            updates["address"] = data["address"].strip()
        if phone and not customer.phone:
            updates["phone"] = phone
        if email and not customer.email:
            updates["email"] = email
        if location is not None and customer.location is None:
            customer.location = location
            updates["location"] = location
        if updates:
            for k, v in updates.items():
                setattr(customer, k, v)
            customer.save(update_fields=list(updates.keys()) + ["updated_at"])

    job = Job.objects.create(
        business=biz,
        customer=customer,
        service_type=service.name,
        notes=data.get("notes", ""),
        address=customer.address,
        location=location or customer.location,
        scheduled_at=data["scheduled_at"],
        duration_minutes=service.duration_minutes,
        price=service.price,
        status=Job.Status.PENDING,
    )
    attach_active_indemnity(job)

    return Response(
        {
            "booking_id": job.id,
            "customer_id": customer.id,
            "scheduled_at": job.scheduled_at.isoformat(),
            "service": service.name,
            "status": job.status,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_check_slot(request, slug: str):
    biz = _get_active_business(slug)
    scheduled_raw = request.data.get("scheduled_at")
    service_id = request.data.get("service_id")
    scheduled_at = parse_datetime(scheduled_raw) if scheduled_raw else None
    if scheduled_at is None or not service_id:
        return Response(
            {"detail": "scheduled_at and service_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    service = get_object_or_404(Service, pk=service_id, business=biz, is_active=True)
    slot = check_slot(
        business=biz,
        scheduled_at=scheduled_at,
        duration_minutes=service.duration_minutes,
    )
    # Public response deliberately excludes conflicting-job PII.
    return Response(
        {
            "ok": slot.ok,
            "reason": slot.reason,
            "suggested_slots": slot.suggested_slots or [],
        }
    )


def _lookup_customer(
    business: Business, email: str, phone: str
) -> Customer | None:
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    customer = None
    if email:
        customer = Customer.objects.filter(
            business=business, email__iexact=email
        ).first()
    if customer is None and phone:
        customer = Customer.objects.filter(business=business, phone=phone).first()
    return customer


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_lookup_customer(request, slug: str):
    """Look up a customer by email/phone so the public form can prefill.

    Deliberately narrow: only returns the fields the booking form uses. The
    throttle (20/hour per IP) caps enumeration risk. Returns `{found: false}`
    if nothing matches so the caller never distinguishes "no match" from
    "invalid input".
    """
    biz = _get_active_business(slug)
    data = request.data or {}
    existing = _lookup_customer(biz, data.get("email", ""), data.get("phone", ""))
    if existing is None:
        return Response({"found": False})
    return Response(
        {
            "found": True,
            "full_name": existing.full_name,
            "email": existing.email,
            "phone": existing.phone,
            "address": existing.address,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_suggest_slots(request, slug: str):
    """Return ranked open slots for a given day.

    If the submitted email/phone matches a customer already on file, their
    location is used silently for travel scoring so recommendations reflect
    actual drive time. No PII (existence flag, name, address, neighbour job
    IDs) is echoed back to the client.
    """
    biz = _get_active_business(slug)
    data = request.data or {}

    day = parse_date(data.get("date") or "")
    if day is None:
        return Response(
            {"detail": "date (YYYY-MM-DD) is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    service_id = data.get("service_id")
    if not service_id:
        return Response(
            {"detail": "service_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    service = get_object_or_404(
        Service, pk=service_id, business=biz, is_active=True
    )

    existing = _lookup_customer(biz, data.get("email", ""), data.get("phone", ""))
    lat = lng = None
    if existing is not None and existing.location is not None:
        lat = existing.location.y
        lng = existing.location.x

    result = scheduler.suggest_slots(
        business=biz,
        day=day,
        duration_minutes=service.duration_minutes,
        lat=lat,
        lng=lng,
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
                    "total_travel_minutes": r.travel_before + r.travel_after,
                }
                for r in result.recommendations
            ],
            "other_available": [s.isoformat() for s in result.other_available[:20]],
        }
    )
