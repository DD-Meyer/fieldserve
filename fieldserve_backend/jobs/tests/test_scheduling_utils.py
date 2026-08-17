"""Slot validation tests for the scheduling utils."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone

from jobs.models import Job
from jobs.scheduling_utils import check_slot


pytestmark = pytest.mark.django_db


def _dt(y, m, d, hh, mm):
    return timezone.make_aware(datetime(y, m, d, hh, mm))


def test_outside_hours_rejected(business):
    business.working_hours_start = time(8, 0)
    business.working_hours_end = time(18, 0)
    business.save()

    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 7, 30),
        duration_minutes=30,
    )
    assert not result.ok
    assert result.reason == "outside_hours"
    assert result.suggested_slots, "should return in-hours suggestions"
    assert all("T08:" in s or "T09:" in s or "T10:" in s for s in result.suggested_slots[:1])


def test_end_after_close_rejected(business):
    business.working_hours_end = time(18, 0)
    business.save()
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 17, 45),
        duration_minutes=60,
    )
    assert not result.ok
    assert result.reason == "outside_hours"


def test_buffer_conflict_no_coords(business, customer):
    business.default_travel_buffer_minutes = 30
    business.save()
    Job.objects.create(
        business=business,
        customer=customer,
        service_type="Wash",
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        price=Decimal("0"),
        status=Job.Status.SCHEDULED,
    )
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 10, 45),
        duration_minutes=30,
    )
    assert not result.ok
    assert result.reason == "buffer_conflict"
    assert len(result.suggested_slots) > 0


def test_ok_when_gap_meets_floor(business, customer):
    business.default_travel_buffer_minutes = 15
    business.save()
    Job.objects.create(
        business=business,
        customer=customer,
        service_type="Wash",
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        price=Decimal("0"),
        status=Job.Status.SCHEDULED,
    )
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 11, 0),
        duration_minutes=30,
    )
    assert result.ok


def test_distance_dominates_floor(business, customer):
    business.default_travel_buffer_minutes = 5
    business.save()
    # Existing job in central London.
    Job.objects.create(
        business=business,
        customer=customer,
        service_type="Wash",
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        location=Point(-0.1278, 51.5074, srid=4326),
        price=Decimal("0"),
        status=Job.Status.SCHEDULED,
    )
    # New job in Reading ~60km away — needs ~90 min travel, more than 5 min floor.
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 10, 45),
        duration_minutes=30,
        lat=51.4543,
        lng=-0.9781,
    )
    assert not result.ok
    assert result.reason == "buffer_conflict"


def test_exclude_job_id_ignores_self(business, customer):
    business.default_travel_buffer_minutes = 15
    business.save()
    j = Job.objects.create(
        business=business,
        customer=customer,
        service_type="Wash",
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        price=Decimal("0"),
        status=Job.Status.SCHEDULED,
    )
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        exclude_job_id=j.pk,
    )
    assert result.ok


def test_cancelled_jobs_ignored(business, customer):
    business.default_travel_buffer_minutes = 30
    business.save()
    Job.objects.create(
        business=business,
        customer=customer,
        service_type="Wash",
        scheduled_at=_dt(2026, 8, 20, 10, 0),
        duration_minutes=30,
        price=Decimal("0"),
        status=Job.Status.CANCELLED,
    )
    result = check_slot(
        business=business,
        scheduled_at=_dt(2026, 8, 20, 10, 15),
        duration_minutes=30,
    )
    assert result.ok
