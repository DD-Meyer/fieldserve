"""Score a single customer against the live ML model.

Used by:
- the `score_churn` management command (batch),
- the `post_save` signal on `Job` (per-customer rescoring),
- the `/api/analytics/churn/scores/rescore/<customer_pk>/` action.

Returns the persisted ChurnScore, or None when the customer has no booking
history yet (we intentionally skip writing a score so the CRM can render a
"no score yet" placeholder instead of a misleading 0%).
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.utils import timezone

from jobs.models import Job
from users.models import Customer

from .feature_builder import EXT_FEATURES, build_features_for_customer
from .ml_client import MLClient, MLServiceError
from .models import ChurnScore

log = logging.getLogger(__name__)


def _json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def has_booking_history(customer: Customer) -> bool:
    return Job.objects.filter(customer=customer).exists()


def score_customer(
    customer: Customer,
    *,
    client: MLClient | None = None,
    as_of: datetime | None = None,
) -> ChurnScore | None:
    """Compute features for one customer, call the ML service, persist a score.

    Returns None (and writes nothing) when the customer has no bookings.
    """
    if not has_booking_history(customer):
        log.debug("score_customer: skipping customer %s (no bookings)", customer.pk)
        return None

    client = client or MLClient()
    as_of = as_of or timezone.now()

    row = build_features_for_customer(customer, as_of=as_of)
    resp = client.predict_churn([row], as_of=as_of.isoformat())
    preds = resp.get("predictions", [])
    if not preds:
        log.warning("score_customer: empty predictions for customer %s", customer.pk)
        return None

    p = preds[0]
    snapshot = {k: _json_safe(row.get(k)) for k in EXT_FEATURES}
    return ChurnScore.objects.create(
        customer=customer,
        scored_at=as_of,
        probability=Decimal(str(round(float(p["probability"]), 4))),
        risk_bucket=p["risk_bucket"],
        model_version=resp.get("model_version", "unknown"),
        model_name=resp.get("model_name", "unknown"),
        feature_set=resp.get("feature_set", "unknown"),
        feature_snapshot=snapshot,
    )


def safe_score_customer(customer: Customer) -> ChurnScore | None:
    """Best-effort rescoring for signal handlers — swallows ML errors."""
    try:
        return score_customer(customer)
    except MLServiceError as exc:
        log.warning("ML rescore failed for customer %s: %s", customer.pk, exc)
        return None
    except Exception:
        log.exception("Unexpected error rescoring customer %s", customer.pk)
        return None
