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

import requests
from django.conf import settings
from django.contrib.gis.geos import Point
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date, parse_datetime
from django.views.decorators.cache import never_cache
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from jobs.indemnity import active_indemnity_for, attach_active_indemnity
from jobs.models import Job
from jobs.scheduling_utils import check_slot_for_any, find_available_member, suggest_slots_for_any
from users.models import Customer

from .models import Business, IndemnityDocument, Membership, Service


class _BookingThrottle(AnonRateThrottle):
    scope = "public_booking"
    rate = "20/hour"


class _SlotsThrottle(AnonRateThrottle):
    """Read-only availability lookups — called far more often than an actual
    booking (e.g. once per keystroke/date-pick), so needs a looser bucket."""

    scope = "public_slots"
    rate = "120/minute"


class _PlacesThrottle(AnonRateThrottle):
    scope = "public_places"
    rate = "60/minute"


def _geocode_address(address: str) -> tuple[float, float] | None:
    """Best-effort server-side geocode fallback for typed (unselected) addresses."""
    api_key = getattr(settings, "GOOGLE_PLACES_SERVER_KEY", "")
    if not api_key or not address.strip():
        return None
    try:
        upstream = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": api_key},
            timeout=5,
        )
        upstream.raise_for_status()
        data = upstream.json()
    except (requests.RequestException, ValueError):
        return None
    results = data.get("results") or []
    if not results:
        return None
    location = (results[0].get("geometry") or {}).get("location") or {}
    lat, lng = location.get("lat"), location.get("lng")
    return (lat, lng) if lat is not None and lng is not None else None


class PublicBusinessSerializer(serializers.ModelSerializer):
    has_published_indemnity = serializers.SerializerMethodField()

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
            "has_published_indemnity",
        )

    def get_has_published_indemnity(self, obj: Business) -> bool:
        return obj.indemnities.filter(status=IndemnityDocument.Status.PUBLISHED).exists()


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


def _qualified_members(business: Business, service: Service):
    """Active members qualified to perform this service, for auto-assignment."""
    memberships = Membership.objects.filter(
        business=business,
        status=Membership.Status.ACTIVE,
        user__isnull=False,
        services=service,
    ).select_related("user")
    return [m.user for m in memberships]


@never_cache
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_BookingThrottle])
def public_business_detail(request, slug: str):
    biz = get_object_or_404(Business, slug=slug)
    return Response(PublicBusinessSerializer(biz).data)


@never_cache
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

    if biz.industry_mode == Business.Industry.MOBILE:
        address = (data.get("address") or "").strip()
        if not address:
            raise serializers.ValidationError(
                {"location": "Mobile bookings require a service address."}
            )
        if data.get("latitude") is None or data.get("longitude") is None:
            # Client didn't select an autocomplete suggestion (e.g. it was
            # rate-limited) — geocode the typed address ourselves rather
            # than blocking the booking entirely.
            geocoded = _geocode_address(address)
            if geocoded is None:
                raise serializers.ValidationError(
                    {
                        "location": (
                            "Couldn't confirm that address. Please select it "
                            "from the suggestions or check it's correct."
                        )
                    }
                )
            data["latitude"], data["longitude"] = geocoded

    service = get_object_or_404(
        Service, pk=data["service_id"], business=biz, is_active=True
    )
    active_indemnity_for(biz)

    candidates = _qualified_members(biz, service)
    if not candidates:
        return Response(
            {
                "detail": "slot_unavailable",
                "reason": "no_qualified_staff",
                "suggested_slots": [],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    slot = check_slot_for_any(
        business=biz,
        scheduled_at=data["scheduled_at"],
        duration_minutes=service.duration_minutes,
        candidates=candidates,
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

    # Find-or-create the customer within this business, keyed by email when
    # provided — a different email always means a different customer, even if
    # the phone number happens to match someone else on file.
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    location = None
    if data.get("latitude") is not None:
        location = Point(data["longitude"], data["latitude"], srid=4326)
    if email:
        customer = Customer.objects.filter(business=biz, email__iexact=email).first()
    else:
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
        # Latest submission wins: overwrite any changed, non-blank contact details.
        updates: dict[str, str] = {}
        full_name = data["full_name"].strip()
        if full_name and customer.full_name != full_name:
            updates["full_name"] = full_name
        address = (data.get("address") or "").strip()
        if address and customer.address != address:
            updates["address"] = address
        if phone and customer.phone != phone:
            updates["phone"] = phone
        if email and customer.email != email:
            updates["email"] = email
        if location is not None and customer.location != location:
            customer.location = location
            updates["location"] = location
        if updates:
            for k, v in updates.items():
                setattr(customer, k, v)
            customer.save(update_fields=list(updates.keys()) + ["updated_at"])

    # Re-resolve the actual assignee at commit time to close the race window
    # between the pre-flight check above and this write.
    with transaction.atomic():
        assignee = find_available_member(
            business=biz,
            scheduled_at=data["scheduled_at"],
            duration_minutes=service.duration_minutes,
            candidates=candidates,
            lat=data.get("latitude"),
            lng=data.get("longitude"),
        )
        if assignee is None:
            return Response(
                {
                    "detail": "slot_unavailable",
                    "reason": "buffer_conflict",
                    "suggested_slots": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = Job.objects.create(
            business=biz,
            customer=customer,
            assigned_to=assignee,
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
@throttle_classes([_SlotsThrottle])
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
    candidates = _qualified_members(biz, service)
    slot = check_slot_for_any(
        business=biz,
        scheduled_at=scheduled_at,
        duration_minutes=service.duration_minutes,
        candidates=candidates,
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


@never_cache
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_PlacesThrottle])
def public_places_autocomplete(request):
    """Proxy Google's Places Autocomplete API so the key stays server-side.

    Used by the web booking page, which can't safely bundle a browser-callable
    key (react-native-google-places-autocomplete is native-only there).
    """
    query = (request.query_params.get("input") or "").strip()
    api_key = getattr(settings, "GOOGLE_PLACES_SERVER_KEY", "")
    if len(query) < 2 or not api_key:
        return Response({"predictions": []})
    try:
        upstream = requests.get(
            "https://maps.googleapis.com/maps/api/place/autocomplete/json",
            params={"input": query, "types": "address", "key": api_key},
            timeout=5,
        )
        upstream.raise_for_status()
        data = upstream.json()
    except (requests.RequestException, ValueError):
        return Response({"predictions": []})
    predictions = [
        {"place_id": p.get("place_id"), "description": p.get("description")}
        for p in data.get("predictions", [])
        if p.get("place_id") and p.get("description")
    ]
    return Response({"predictions": predictions})


@never_cache
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([_PlacesThrottle])
def public_places_details(request):
    """Resolve a place_id (from `public_places_autocomplete`) to lat/lng."""
    place_id = (request.query_params.get("place_id") or "").strip()
    if not place_id:
        return Response(
            {"detail": "place_id is required."}, status=status.HTTP_400_BAD_REQUEST
        )
    api_key = getattr(settings, "GOOGLE_PLACES_SERVER_KEY", "")
    if not api_key:
        return Response(
            {"detail": "Address lookup is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    try:
        upstream = requests.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "place_id": place_id,
                "fields": "formatted_address,geometry",
                "key": api_key,
            },
            timeout=5,
        )
        upstream.raise_for_status()
        data = upstream.json()
    except (requests.RequestException, ValueError):
        return Response(
            {"detail": "Address lookup failed."}, status=status.HTTP_502_BAD_GATEWAY
        )
    result = data.get("result") or {}
    location = (result.get("geometry") or {}).get("location") or {}
    return Response(
        {
            "description": result.get("formatted_address", ""),
            "latitude": location.get("lat"),
            "longitude": location.get("lng"),
        }
    )


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
@throttle_classes([_SlotsThrottle])
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

    candidates = _qualified_members(biz, service)
    result = suggest_slots_for_any(
        business=biz,
        day=day,
        duration_minutes=service.duration_minutes,
        candidates=candidates,
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
