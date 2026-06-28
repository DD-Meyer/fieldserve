"""Compute the 17 churn features for a Customer from their Job history.

Mirrors `ml_service/features/churn.py` — the column names + order must match
exactly, otherwise the FastAPI service rejects (or worse, silently mis-scores)
the prediction.

The features are intentionally tolerant to missing data: a brand-new customer
will have NaN for everything except `tenure_days=0`, and the model's imputer
fills in training-set medians at predict time.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import numpy as np
from django.utils import timezone

from jobs.models import Job
from users.models import Customer

# Same ordering as ml_service/features/churn.py EXT_FEATURES.
EXT_FEATURES: tuple[str, ...] = (
    "recency_days",
    "tenure_days",
    "freq_12m",
    "freq_3m",
    "avg_inter_booking_gap",
    "inter_booking_gap_std",
    "total_spend_12m",
    "avg_ticket",
    "monetary_trend",
    "spend_per_visit_std",
    "spend_per_visit_cv",
    "cancellation_rate",
    "unique_item_types",
    "total_units",
    "weekend_share",
    "evening_share",
    "is_uk",
)

_OBS_WINDOW_DAYS = 365
_RECENT_WINDOW_DAYS = 90


def _safe_div(num: float, denom: float) -> float | None:
    if denom in (0, None) or denom != denom:  # NaN check
        return None
    return num / denom


def _is_uk(customer: Customer) -> int | None:
    """Coarse UK flag from the customer's address. Returns None when unknown."""
    addr = (customer.address or "").lower()
    if not addr:
        return None
    if any(token in addr for token in ("united kingdom", " uk", ", uk", "u.k.", "england", "scotland", "wales", "northern ireland")):
        return 1
    return 0


def build_features_for_customer(
    customer: Customer,
    *,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """Return a single feature row for one customer.

    The output always contains all 17 keys (NaN where unknowable) plus the
    `customer_id` so the caller can pair predictions back to the right record.
    """
    as_of = as_of or timezone.now()
    obs_start = as_of - timedelta(days=_OBS_WINDOW_DAYS)
    recent_start = as_of - timedelta(days=_RECENT_WINDOW_DAYS)

    # Pull the full obs-window job history once.
    jobs = list(
        Job.objects.filter(customer=customer, scheduled_at__lt=as_of)
        .order_by("scheduled_at")
        .values(
            "scheduled_at",
            "price",
            "status",
            "service_type",
            "duration_minutes",
        )
    )
    obs_jobs = [j for j in jobs if j["scheduled_at"] >= obs_start]
    recent_jobs = [j for j in obs_jobs if j["scheduled_at"] >= recent_start]

    row: dict[str, Any] = {"customer_id": customer.pk}

    if not jobs:
        for k in EXT_FEATURES:
            row[k] = None
        row["is_uk"] = _is_uk(customer)
        return row

    first_dt = jobs[0]["scheduled_at"]
    last_dt = jobs[-1]["scheduled_at"]

    row["recency_days"] = float((as_of - last_dt).days)
    row["tenure_days"] = float((as_of - first_dt).days)
    row["freq_12m"] = float(len(obs_jobs))
    row["freq_3m"] = float(len(recent_jobs))

    # Inter-booking gaps (days) across the obs window.
    if len(obs_jobs) >= 2:
        dates = sorted(j["scheduled_at"] for j in obs_jobs)
        gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        gaps_arr = np.array(gaps, dtype=float)
        row["avg_inter_booking_gap"] = float(gaps_arr.mean())
        row["inter_booking_gap_std"] = float(gaps_arr.std(ddof=1)) if len(gaps_arr) > 1 else None
    else:
        row["avg_inter_booking_gap"] = None
        row["inter_booking_gap_std"] = None

    # Monetary
    prices = [float(j["price"]) for j in obs_jobs if j["price"] is not None]
    if prices:
        prices_arr = np.array(prices, dtype=float)
        row["total_spend_12m"] = float(prices_arr.sum())
        row["avg_ticket"] = float(prices_arr.mean())
        row["spend_per_visit_std"] = float(prices_arr.std(ddof=1)) if len(prices_arr) > 1 else None
        row["spend_per_visit_cv"] = _safe_div(
            row["spend_per_visit_std"] or float("nan"), row["avg_ticket"]
        )
        # Linear trend over the last 6 invoices (slope of price vs sequence index).
        last_six = prices_arr[-6:]
        if len(last_six) >= 2:
            x = np.arange(len(last_six), dtype=float)
            slope = float(np.polyfit(x, last_six, 1)[0])
            row["monetary_trend"] = slope
        else:
            row["monetary_trend"] = 0.0
    else:
        for k in ("total_spend_12m", "avg_ticket", "spend_per_visit_std", "spend_per_visit_cv", "monetary_trend"):
            row[k] = None

    # Engagement: cancellation rate across ALL obs-window jobs (not just priced).
    if obs_jobs:
        cancelled = sum(1 for j in obs_jobs if j["status"] == Job.Status.CANCELLED)
        row["cancellation_rate"] = float(cancelled) / float(len(obs_jobs))
    else:
        row["cancellation_rate"] = None

    # Diversity / volume
    row["unique_item_types"] = float(len({j["service_type"] for j in obs_jobs if j["service_type"]}))
    durations = [j["duration_minutes"] for j in obs_jobs if j["duration_minutes"]]
    row["total_units"] = float(sum(durations)) if durations else float(len(obs_jobs))

    # Calendar shares
    if obs_jobs:
        weekend = sum(1 for j in obs_jobs if j["scheduled_at"].weekday() >= 5)
        evening = sum(1 for j in obs_jobs if j["scheduled_at"].hour >= 17)
        row["weekend_share"] = weekend / len(obs_jobs)
        row["evening_share"] = evening / len(obs_jobs)
    else:
        row["weekend_share"] = None
        row["evening_share"] = None

    row["is_uk"] = _is_uk(customer)
    return row


def build_features_for_business(
    business_id: int,
    *,
    as_of: datetime | None = None,
) -> list[dict[str, Any]]:
    """Return one feature row per customer in the business."""
    customers = Customer.objects.filter(business_id=business_id)
    return [build_features_for_customer(c, as_of=as_of) for c in customers]
