"""Shared pytest fixtures for FieldServe backend tests."""

from __future__ import annotations

from decimal import Decimal
from typing import Callable

import pytest
from django.utils import timezone

from businesses.models import Business, Membership, Service
from jobs.models import Job
from users.models import Customer, User


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        username="tester",
        email="tester@example.com",
        password="pw",
        clerk_user_id="clerk_test_1",
    )


@pytest.fixture
def business(db, user) -> Business:
    biz = Business.objects.create(
        owner=user,
        name="Test Detailing Co",
        slug="test-detailing-co",
    )
    Membership.objects.create(
        business=biz,
        user=user,
        role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return biz


@pytest.fixture
def service(db, business) -> Service:
    return Service.objects.create(
        business=business,
        name="Express Wash",
        slug="express-wash",
        duration_minutes=30,
        price=Decimal("25.00"),
        is_active=True,
    )


@pytest.fixture
def customer(db, business) -> Customer:
    return Customer.objects.create(
        business=business,
        full_name="Ada Lovelace",
        email="ada@example.com",
        phone="+441234567890",
        address="1 King's Cross, London, UK",
    )


@pytest.fixture
def make_job(db, business, customer) -> Callable[..., Job]:
    def _make(**overrides) -> Job:
        defaults = dict(
            business=business,
            customer=customer,
            service_type="Express Wash",
            scheduled_at=timezone.now(),
            price=Decimal("25.00"),
            status=Job.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        defaults.update(overrides)
        return Job.objects.create(**defaults)

    return _make


@pytest.fixture
def disable_ml_signals(monkeypatch):
    """Prevent the post_save signal on Job from calling the ML service."""
    from analytics import signals

    monkeypatch.setattr(signals, "safe_score_customer", lambda customer: None)


@pytest.fixture
def api_client_auth(db, user, business):
    """DRF client force-authenticated as `user` (owner of `business`)."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client
