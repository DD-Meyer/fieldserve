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

from datetime import datetime

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from jobs.models import Job
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
    service_id = serializers.IntegerField()
    scheduled_at = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "Provide at least one of email or phone so we can contact you."
            )
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

    service = get_object_or_404(
        Service, pk=data["service_id"], business=biz, is_active=True
    )

    # Find-or-create the customer within this business.
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
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
        scheduled_at=data["scheduled_at"],
        duration_minutes=service.duration_minutes,
        price=service.price,
        status=Job.Status.PENDING,
    )

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
