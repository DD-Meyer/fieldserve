"""Unit tests for the churn feature builder."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from analytics.feature_builder import EXT_FEATURES, build_features_for_customer
from jobs.models import Job

pytestmark = pytest.mark.django_db


def test_features_all_none_for_jobless_customer(customer):
    row = build_features_for_customer(customer)
    assert row["customer_id"] == customer.pk
    # All numeric features should be None (unknown).
    for key in EXT_FEATURES:
        if key == "is_uk":
            continue
        assert row[key] is None, f"{key} should be None for jobless customer"


def test_features_reflect_single_completed_job(make_job, customer, disable_ml_signals):
    as_of = timezone.now()
    make_job(
        scheduled_at=as_of - timedelta(days=10),
        completed_at=as_of - timedelta(days=10),
        price=Decimal("100.00"),
    )
    row = build_features_for_customer(customer, as_of=as_of)
    assert row["freq_12m"] == 1.0
    assert row["recency_days"] == 10.0
    assert row["total_spend_12m"] == 100.0
    assert row["avg_ticket"] == 100.0


def test_cancellation_rate(make_job, customer, disable_ml_signals):
    as_of = timezone.now()
    make_job(scheduled_at=as_of - timedelta(days=5), status=Job.Status.COMPLETED)
    make_job(scheduled_at=as_of - timedelta(days=6), status=Job.Status.CANCELLED)
    row = build_features_for_customer(customer, as_of=as_of)
    assert row["cancellation_rate"] == 0.5


def test_is_uk_flag(business, customer):
    customer.address = "10 Downing Street, London, UK"
    customer.save()
    row = build_features_for_customer(customer)
    assert row["is_uk"] == 1

    customer.address = "1 Broadway, New York, USA"
    customer.save()
    row = build_features_for_customer(customer)
    assert row["is_uk"] == 0

    customer.address = ""
    customer.save()
    row = build_features_for_customer(customer)
    assert row["is_uk"] is None
