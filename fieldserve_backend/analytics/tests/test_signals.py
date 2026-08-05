"""Tests for the Job post_save signal that rescores customers."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from jobs.models import Job

pytestmark = pytest.mark.django_db


def test_job_save_updates_last_seen_at(monkeypatch, customer):
    from analytics import signals

    monkeypatch.setattr(signals, "safe_score_customer", lambda c: None)

    assert customer.last_seen_at is None
    past = timezone.now() - timedelta(days=3)
    Job.objects.create(
        business=customer.business,
        customer=customer,
        service_type="Test",
        scheduled_at=past,
    )
    customer.refresh_from_db()
    assert customer.last_seen_at is not None
    assert customer.last_seen_at == past


def test_signal_swallows_ml_errors(monkeypatch, customer):
    """A misbehaving ML service must not break booking creation."""
    from analytics import signals

    def boom(*_a, **_kw):
        raise RuntimeError("ml offline")

    monkeypatch.setattr(signals, "safe_score_customer", boom)

    job = Job.objects.create(
        business=customer.business,
        customer=customer,
        service_type="Test",
        scheduled_at=timezone.now(),
    )
    assert job.pk is not None
