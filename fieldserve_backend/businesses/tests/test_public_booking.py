"""End-to-end test for the public booking flow (no Clerk auth required)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from jobs.models import Job
from users.models import Customer, Notification
from businesses.models import IndemnityDocument, Membership

pytestmark = pytest.mark.django_db


def _future_workhour(days: int = 1) -> str:
    """A deterministic ISO datetime N days from now at 10:00 local - safely
    inside the default 08:00-18:00 business window regardless of when the
    test happens to run."""
    when = (timezone.now() + timedelta(days=days)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )
    return when.isoformat()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def published_indemnity(business, user):
    return IndemnityDocument.objects.create(
        business=business,
        created_by=user,
        version=1,
        source=IndemnityDocument.Source.TEXT,
        text="Test indemnity",
        status=IndemnityDocument.Status.PUBLISHED,
    )


@pytest.fixture(autouse=True)
def qualified_for_service(business, user, service):
    Membership.objects.get(business=business, user=user).services.add(service)


def test_public_business_detail(api, business):
    resp = api.get(f"/api/public/businesses/{business.slug}/")
    assert resp.status_code == 200
    assert resp.data["slug"] == business.slug
    assert resp.data["public_booking_enabled"] is True
    assert resp.data["has_published_indemnity"] is True


def test_public_business_detail_without_published_indemnity(api, business):
    business.indemnities.all().delete()
    resp = api.get(f"/api/public/businesses/{business.slug}/")
    assert resp.status_code == 200
    assert resp.data["has_published_indemnity"] is False


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
            "address": "1 King's Cross, London, UK",
            "latitude": 51.5308,
            "longitude": -0.1238,
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
    assert job.address == "1 King's Cross, London, UK"
    assert job.location.x == pytest.approx(-0.1238)
    assert job.location.y == pytest.approx(51.5308)
    notification = Notification.objects.get(user=job.assigned_to)
    assert notification.title == "New booking created"
    assert notification.message == f"{service.name} for Grace Hopper."


def test_public_mobile_booking_requires_address(
    api, business, service, disable_ml_signals
):
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Grace Hopper",
            "email": "grace@example.com",
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=2),
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "location" in resp.data


def test_public_mobile_booking_falls_back_to_geocoding_when_location_missing(
    api, business, service, disable_ml_signals, monkeypatch
):
    monkeypatch.setattr(
        "businesses.public_views._geocode_address",
        lambda address: (51.5308, -0.1238),
    )
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Grace Hopper",
            "email": "grace@example.com",
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=2),
            "address": "1 King's Cross, London, UK",
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    job = Job.objects.get(pk=resp.data["booking_id"])
    assert job.location.x == pytest.approx(-0.1238)
    assert job.location.y == pytest.approx(51.5308)


def test_public_mobile_booking_rejects_ungeocodable_address(
    api, business, service, disable_ml_signals, monkeypatch
):
    monkeypatch.setattr(
        "businesses.public_views._geocode_address", lambda address: None
    )
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Grace Hopper",
            "email": "grace@example.com",
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=2),
            "address": "not a real place",
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "location" in resp.data


def test_public_booking_finds_existing_customer_by_email(
    api, business, service, disable_ml_signals
):
    existing = Customer.objects.create(
        business=business,
        full_name="Ada Byron",
        email="ada.byron@example.com",
        address="1 King's Cross, London, UK",
        location="POINT(-0.1238 51.5308)",
    )
    when = _future_workhour(days=1)
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Ada Byron",
            "email": "ADA.BYRON@example.com",  # different case
            "address": "1 King's Cross, London, UK",
            "latitude": 51.5308,
            "longitude": -0.1238,
            "service_id": service.id,
            "scheduled_at": when,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["customer_id"] == existing.pk


def test_public_booking_overwrites_contact_details_on_repeat(
    api, business, service, disable_ml_signals
):
    existing = Customer.objects.create(
        business=business,
        full_name="Ada Byron",
        email="ada.byron@example.com",
        phone="+15550001",
        address="Old address, London, UK",
    )
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Ada Lovelace",
            "email": "ada.byron@example.com",
            "phone": "+15559999",
            "address": "1 King's Cross, London, UK",
            "latitude": 51.5308,
            "longitude": -0.1238,
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=1),
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["customer_id"] == existing.pk
    existing.refresh_from_db()
    assert existing.full_name == "Ada Lovelace"
    assert existing.phone == "+15559999"
    assert existing.address == "1 King's Cross, London, UK"


def test_public_booking_different_email_creates_new_customer(
    api, business, service, disable_ml_signals
):
    business.industry_mode = business.Industry.FIXED
    business.save(update_fields=["industry_mode"])
    Customer.objects.create(
        business=business,
        full_name="Ada Byron",
        email="ada.byron@example.com",
        phone="+15550001",
    )
    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Someone Else",
            "email": "someone.else@example.com",
            "phone": "+15550001",  # same phone as the existing customer
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=1),
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert Customer.objects.filter(business=business, email="someone.else@example.com").exists()
    assert Customer.objects.filter(business=business).count() == 2


def test_public_fixed_booking_allows_missing_location(
    api, business, service, disable_ml_signals
):
    business.industry_mode = business.Industry.FIXED
    business.save(update_fields=["industry_mode"])

    resp = api.post(
        f"/api/public/businesses/{business.slug}/bookings/",
        {
            "full_name": "Grace Hopper",
            "email": "grace@example.com",
            "service_id": service.id,
            "scheduled_at": _future_workhour(days=2),
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data


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
