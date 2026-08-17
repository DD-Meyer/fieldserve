"""Deterministic gap-insertion scheduler.

The old design tried to reorder jobs with an ML-style nearest-neighbour route
optimiser, which never made physical sense — workers must visit each customer
at the promised time. Instead, when the customer is *booking*, we search the
day's existing appointments for gaps big enough to accommodate the new job,
score each candidate on total travel + fragmentation, and hand back a short
ranked list of proposal times. Locking in the best gap at booking-time is
equivalent (and more honest) to reordering at run-time.

Public API:
    feasible_windows(business, day, duration_minutes, lat, lng, exclude_job_id)
        -> list[Window]
    suggest_slots(business, day, duration_minutes, lat, lng, exclude_job_id,
                  now=None, top_k=3)
        -> SuggestionResult
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from math import asin, ceil, cos, radians, sin, sqrt
from typing import Iterable

from django.utils import timezone

from businesses.models import Business
from .models import Job


DEFAULT_SPEED_KMH = 40.0
SLOT_STEP_MINUTES = 15
DEFAULT_TOP_K = 3
FRAG_SLIVER_MINUTES = 30
FRAG_PENALTY = 15
TRAVEL_WEIGHT = 2.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlam = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlam / 2) ** 2
    return 2 * r * asin(sqrt(a))


def travel_minutes(km: float) -> int:
    return ceil(km / DEFAULT_SPEED_KMH * 60)


@dataclass
class Anchor:
    """A fixed point on the timeline the new job must be scheduled around."""

    start: datetime
    end: datetime
    lat: float | None
    lng: float | None
    job_id: int | None = None  # None for day-open/day-close virtual anchors


@dataclass
class Window:
    """A feasible time range between two consecutive anchors.

    `earliest` is the earliest start time inside this gap that satisfies both
    the prior anchor's travel requirement and the working-hours open. `latest`
    is the latest start time that still leaves enough travel + duration time
    before the next anchor / close.
    """

    earliest: datetime
    latest: datetime
    prev: Anchor
    next: Anchor
    travel_before: int  # minutes from prev anchor to the new job
    travel_after: int   # minutes from the new job to the next anchor

    def contains(self, start: datetime) -> bool:
        return self.earliest <= start <= self.latest


@dataclass
class Recommendation:
    start: datetime
    end: datetime
    score: int
    label: str
    previous_job_id: int | None
    next_job_id: int | None
    travel_before: int
    travel_after: int


@dataclass
class SuggestionResult:
    day: date
    recommendations: list[Recommendation]
    other_available: list[datetime]


def _combine(day: date, t: time, tz) -> datetime:
    return timezone.make_aware(datetime.combine(day, t), tz)


def _required_travel(
    business: Business,
    lat_a: float | None,
    lng_a: float | None,
    lat_b: float | None,
    lng_b: float | None,
) -> int:
    floor = int(business.default_travel_buffer_minutes or 0)
    if lat_a is None or lng_a is None or lat_b is None or lng_b is None:
        return floor
    return max(floor, travel_minutes(haversine_km(lat_a, lng_a, lat_b, lng_b)))


def _day_anchors(
    business: Business,
    day: date,
    tz,
    exclude_job_id: int | None,
) -> list[Anchor]:
    """Return anchors in chronological order: day-open, jobs..., day-close.

    Day-open and day-close use the business depot location if set, otherwise
    they have no coordinates and only the buffer floor applies between them
    and the new job.
    """
    open_dt = _combine(day, business.working_hours_start, tz)
    close_dt = _combine(day, business.working_hours_end, tz)

    depot_lat = depot_lng = None
    if business.depot_location is not None:
        depot_lat = business.depot_location.y
        depot_lng = business.depot_location.x

    anchors: list[Anchor] = [
        Anchor(start=open_dt, end=open_dt, lat=depot_lat, lng=depot_lng),
    ]

    qs = Job.objects.filter(
        business=business,
        scheduled_at__date=day,
    ).exclude(status=Job.Status.CANCELLED).order_by("scheduled_at")
    if exclude_job_id is not None:
        qs = qs.exclude(pk=exclude_job_id)

    for j in qs:
        dur = int(j.duration_minutes or 30)
        lat = j.location.y if j.location is not None else None
        lng = j.location.x if j.location is not None else None
        anchors.append(
            Anchor(
                start=j.scheduled_at,
                end=j.scheduled_at + timedelta(minutes=dur),
                lat=lat,
                lng=lng,
                job_id=j.pk,
            )
        )

    anchors.append(
        Anchor(start=close_dt, end=close_dt, lat=depot_lat, lng=depot_lng)
    )
    return anchors


def feasible_windows(
    business: Business,
    day: date,
    duration_minutes: int,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
) -> list[Window]:
    tz = timezone.get_current_timezone()
    duration_minutes = int(duration_minutes or 30)
    dur = timedelta(minutes=duration_minutes)

    anchors = _day_anchors(business, day, tz, exclude_job_id)
    windows: list[Window] = []
    for prev, nxt in zip(anchors, anchors[1:]):
        travel_before = _required_travel(business, prev.lat, prev.lng, lat, lng)
        travel_after = _required_travel(business, lat, lng, nxt.lat, nxt.lng)
        earliest = prev.end + timedelta(minutes=travel_before)
        latest = nxt.start - timedelta(minutes=travel_after) - dur
        if earliest > latest:
            continue
        windows.append(
            Window(
                earliest=earliest,
                latest=latest,
                prev=prev,
                next=nxt,
                travel_before=travel_before,
                travel_after=travel_after,
            )
        )
    return windows


def _align_up(dt: datetime, step_minutes: int) -> datetime:
    dt = dt.replace(second=0, microsecond=0)
    rem = dt.minute % step_minutes
    if rem:
        dt = dt + timedelta(minutes=step_minutes - rem)
    return dt


def _fragmentation_penalty(window: Window, start: datetime, duration: timedelta) -> int:
    end = start + duration
    idle_before = int((start - window.earliest).total_seconds() // 60)
    idle_after = int((window.latest - start).total_seconds() // 60)
    penalty = 0
    if 0 < idle_before < FRAG_SLIVER_MINUTES:
        penalty += FRAG_PENALTY
    if 0 < idle_after < FRAG_SLIVER_MINUTES:
        penalty += FRAG_PENALTY
    _ = end  # placeholder — end is (window bounds already account for duration)
    return penalty


def _score(window: Window, start: datetime, duration: timedelta) -> int:
    travel_cost = window.travel_before + window.travel_after
    frag = _fragmentation_penalty(window, start, duration)
    raw = 100 - travel_cost * TRAVEL_WEIGHT - frag
    return max(0, min(100, int(round(raw))))


def _label_for(rank: int) -> str:
    return "Best fit" if rank == 0 else "Good fit"


def suggest_slots(
    business: Business,
    day: date,
    duration_minutes: int,
    lat: float | None = None,
    lng: float | None = None,
    exclude_job_id: int | None = None,
    now: datetime | None = None,
    top_k: int = DEFAULT_TOP_K,
) -> SuggestionResult:
    tz = timezone.get_current_timezone()
    duration_minutes = int(duration_minutes or 30)
    dur = timedelta(minutes=duration_minutes)
    now = now or timezone.now()

    windows = feasible_windows(
        business, day, duration_minutes, lat, lng, exclude_job_id
    )

    # Pick the earliest slot in each window as the recommendation candidate,
    # then rank by score. This gives us at most one recommendation per gap so
    # we don't flood the UI with clustered options inside a single big window.
    candidates: list[tuple[Window, datetime]] = []
    for w in windows:
        start = _align_up(max(w.earliest, now), SLOT_STEP_MINUTES)
        if start > w.latest:
            continue
        candidates.append((w, start))

    ranked = sorted(
        candidates,
        key=lambda pair: (-_score(pair[0], pair[1], dur), pair[1]),
    )

    recommendations: list[Recommendation] = []
    used_windows: set[int] = set()
    for i, (w, start) in enumerate(ranked[:top_k]):
        recommendations.append(
            Recommendation(
                start=start,
                end=start + dur,
                score=_score(w, start, dur),
                label=_label_for(i),
                previous_job_id=w.prev.job_id,
                next_job_id=w.next.job_id,
                travel_before=w.travel_before,
                travel_after=w.travel_after,
            )
        )
        used_windows.add(id(w))

    # Everything else that's bookable, listed but unranked.
    other: list[datetime] = []
    for w in windows:
        if id(w) in used_windows:
            # still emit any additional aligned slots inside this window
            step = _align_up(max(w.earliest, now), SLOT_STEP_MINUTES)
            # skip the first (already recommended) slot
            step = step + timedelta(minutes=SLOT_STEP_MINUTES)
        else:
            step = _align_up(max(w.earliest, now), SLOT_STEP_MINUTES)
        while step <= w.latest:
            other.append(step)
            step = step + timedelta(minutes=SLOT_STEP_MINUTES)

    return SuggestionResult(day=day, recommendations=recommendations, other_available=other)


def is_within_hours(
    business: Business, scheduled_at: datetime, duration_minutes: int
) -> bool:
    tz = timezone.get_current_timezone()
    if timezone.is_naive(scheduled_at):
        scheduled_at = timezone.make_aware(scheduled_at, tz)
    local = timezone.localtime(scheduled_at, tz)
    day = local.date()
    open_dt = _combine(day, business.working_hours_start, tz)
    close_dt = _combine(day, business.working_hours_end, tz)
    end_dt = scheduled_at + timedelta(minutes=int(duration_minutes or 30))
    return scheduled_at >= open_dt and end_dt <= close_dt
