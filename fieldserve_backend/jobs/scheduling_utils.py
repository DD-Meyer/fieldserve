"""Serializer-level guard that gates job creates/updates.

Kept as a thin wrapper for backward compatibility with `JobSerializer.validate`
and the public booking endpoint. Internally delegates to `jobs.scheduler` so
buffer semantics stay consistent between the pre-flight suggestion API and
the hard block at save time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone

from businesses.models import Business

from . import scheduler
from .scheduler import haversine_km  # re-exported for tests / callers


@dataclass
class SlotResult:
    ok: bool
    reason: str | None = None
    suggested_slots: list[str] | None = None

    def as_error(self) -> dict:
        return {
            "scheduled_at": self.reason or "conflict",
            "suggested_slots": self.suggested_slots or [],
        }


def _suggest_iso(
    business: Business,
    scheduled_at: datetime,
    duration_minutes: int,
    lat: float | None,
    lng: float | None,
    exclude_job_id: int | None,
) -> list[str]:
    tz = timezone.get_current_timezone()
    local = timezone.localtime(scheduled_at, tz)
    result = scheduler.suggest_slots(
        business,
        local.date(),
        duration_minutes,
        lat,
        lng,
        exclude_job_id=exclude_job_id,
    )
    return [r.start.isoformat() for r in result.recommendations]


def check_slot(
    business: Business,
    scheduled_at: datetime,
    duration_minutes: int,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
) -> SlotResult:
    tz = timezone.get_current_timezone()
    if timezone.is_naive(scheduled_at):
        scheduled_at = timezone.make_aware(scheduled_at, tz)

    if not scheduler.is_within_hours(business, scheduled_at, duration_minutes):
        return SlotResult(
            ok=False,
            reason="outside_hours",
            suggested_slots=_suggest_iso(
                business, scheduled_at, duration_minutes, lat, lng, exclude_job_id
            ),
        )

    local = timezone.localtime(scheduled_at, tz)
    windows = scheduler.feasible_windows(
        business,
        local.date(),
        duration_minutes,
        lat,
        lng,
        exclude_job_id=exclude_job_id,
    )
    if any(w.contains(scheduled_at) for w in windows):
        return SlotResult(ok=True)

    return SlotResult(
        ok=False,
        reason="buffer_conflict",
        suggested_slots=_suggest_iso(
            business, scheduled_at, duration_minutes, lat, lng, exclude_job_id
        ),
    )


__all__ = ["SlotResult", "check_slot", "haversine_km"]
