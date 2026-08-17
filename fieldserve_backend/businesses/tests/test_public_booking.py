"""End-to-end test for the public booking flow (no Clerk auth required)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from jobs.models import Job
from users.models import Customer

pytestmark = pytest.mark.django_db


def _future_workhour(days: int = 1) -> str:
    """A deterministic ISO datetime N days from now at 10:00 local — safely
    inside the default 08:00-18:00 business window regardless of when the
    test happens to run."""
    when = (timezone.now() + timedelta(days=days)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    return when.isoformat()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


def test_public_business_detail(api, business):
    resp = api.get(f"/api/public/businesses/{business.slug}/")
    assert resp.status_code == 200
    assert resp.data["slug"] == business.slug
    assert resp.data["public_booking_enabled"] is True


def test_public_service_list(api, business, service):
    resp = api.get(f"/api/public/businesses/{business.slug}/services/")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["slug"] == service.slug


def test_public_booking_creates_customer_and_job(
    api, business, service, disable_ml_signals
):
    when = _future_workhour(days=2)
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Grace Hopper",
            "email": "grace@example.com",
            "phone": "+15551234",
            "service_id": service.id,
            "scheduled_at": when,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert Customer.objects.filter(business=business, email="grace@example.com").exists()
    job = Job.objects.get(pk=resp.data["booking_id"])
    assert job.status == Job.Status.PENDING
    assert job.service_type == service.name


def test_public_booking_finds_existing_customer_by_email(
    api, business, service, disable_ml_signals
):
    existing = Customer.objects.create(
        business=business,
        full_name="Ada Byron",
        email="ada.byron@example.com",
    )
    when = _future_workhour(days=1)
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Ada Byron",
            "email": "ADA.BYRON@example.com",  # different case
            "service_id": service.id,
            "scheduled_at": when,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["customer_id"] == existing.pk


def test_public_booking_requires_contact(api, business, service, disable_ml_signals):
    when = _future_workhour(days=1)
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Anon",
            "service_id": service.id,
            "scheduled_at": when,
        },
        format="json",
    )
    assert resp.status_code == 400


def test_public_booking_disabled(api, business, service, disable_ml_signals):
    business.public_booking_enabled = False
    business.save()
    when = _future_workhour(days=1)
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Anon",
            "email": "a@b.com",
            "service_id": service.id,
            "scheduled_at": when,
        },
        format="json",
    )
    assert resp.status_code == 400
