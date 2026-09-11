"""Serializer-level guard that gates job creates/updates.

Kept as a thin wrapper for backward compatibility with `JobSerializer.validate`
and the public booking endpoint. Internally delegates to `jobs.scheduler` so
buffer semantics stay consistent between the pre-flight suggestion API and
the hard block at save time.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
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
    assigned_to=None,
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
        assigned_to=assigned_to,
    )
    return [r.start.isoformat() for r in result.recommendations]


def check_slot(
    business: Business,
    scheduled_at: datetime,
    duration_minutes: int,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
    assigned_to=None,
) -> SlotResult:
    tz = timezone.get_current_timezone()
    if timezone.is_naive(scheduled_at):
        scheduled_at = timezone.make_aware(scheduled_at, tz)

    if not scheduler.is_within_hours(business, scheduled_at, duration_minutes):
        return SlotResult(
            ok=False,
            reason="outside_hours",
            suggested_slots=_suggest_iso(
                business, scheduled_at, duration_minutes, lat, lng, exclude_job_id, assigned_to
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
        assigned_to=assigned_to,
    )
    if any(w.contains(scheduled_at) for w in windows):
        return SlotResult(ok=True)

    return SlotResult(
        ok=False,
        reason="buffer_conflict",
        suggested_slots=_suggest_iso(
            business, scheduled_at, duration_minutes, lat, lng, exclude_job_id, assigned_to
        ),
    )


def find_available_member(
    business: Business,
    scheduled_at: datetime,
    duration_minutes: int,
    candidates,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
):
    """Return the first candidate whose own schedule can fit this slot, or None."""
    for user in candidates:
        result = check_slot(
            business, scheduled_at, duration_minutes, lat, lng, exclude_job_id, assigned_to=user
        )
        if result.ok:
            return user
    return None


def check_slot_for_any(
    business: Business,
    scheduled_at: datetime,
    duration_minutes: int,
    candidates,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
) -> SlotResult:
    """A slot is offered publicly if at least one qualifying member can take it."""
    candidates = list(candidates)
    if not candidates:
        return SlotResult(ok=False, reason="no_qualified_staff", suggested_slots=[])
    fallback: SlotResult | None = None
    for user in candidates:
        result = check_slot(
            business, scheduled_at, duration_minutes, lat, lng, exclude_job_id, assigned_to=user
        )
        if result.ok:
            return result
        fallback = fallback or result
    return fallback


def suggest_slots_for_any(
    business: Business,
    day,
    duration_minutes: int,
    candidates,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
    now: datetime | None = None,
    top_k: int = scheduler.DEFAULT_TOP_K,
) -> scheduler.SuggestionResult:
    """Merge suggestions across qualifying candidates without exposing who owns which slot."""
    candidates = list(candidates)
    if not candidates:
        return scheduler.SuggestionResult(day=day, recommendations=[], other_available=[])

    per_candidate = [
        scheduler.suggest_slots(
            business, day, duration_minutes, lat, lng, exclude_job_id, now, top_k, assigned_to=user
        )
        for user in candidates
    ]

    best_by_start: dict[datetime, scheduler.Recommendation] = {}
    for res in per_candidate:
        for rec in res.recommendations:
            existing = best_by_start.get(rec.start)
            if existing is None or rec.score > existing.score:
                best_by_start[rec.start] = rec
    merged = sorted(best_by_start.values(), key=lambda r: (-r.score, r.start))[:top_k]
    relabeled = [replace(rec, label=scheduler._label_for(i)) for i, rec in enumerate(merged)]

    other = sorted({dt for res in per_candidate for dt in res.other_available})
    return scheduler.SuggestionResult(day=day, recommendations=relabeled, other_available=other)


__all__ = [
    "SlotResult",
    "check_slot",
    "find_available_member",
    "check_slot_for_any",
    "suggest_slots_for_any",
    "haversine_km",
]
