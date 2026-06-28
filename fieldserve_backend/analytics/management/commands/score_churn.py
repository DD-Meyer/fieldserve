"""score_churn — push every customer through the ML service and persist scores.

Usage:
    python manage.py score_churn                  # all businesses
    python manage.py score_churn --business-id 3  # single tenant
    python manage.py score_churn --batch-size 200
"""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Any, Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from analytics.feature_builder import EXT_FEATURES, build_features_for_customer
from analytics.ml_client import MLClient, MLServiceError
from analytics.models import ChurnScore
from users.models import Customer


def _chunk(seq: list, size: int) -> Iterable[list]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _json_safe(value: Any) -> Any:
    # PostgreSQL JSON rejects NaN/Inf; coerce to None.
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


class Command(BaseCommand):
    help = "Score customers for churn risk and persist ChurnScore rows."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--business-id", type=int, default=None)
        parser.add_argument("--batch-size", type=int, default=100)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts) -> None:
        batch_size = max(1, int(opts["batch_size"]))
        dry_run = bool(opts["dry_run"])

        qs = Customer.objects.all()
        if opts["business_id"] is not None:
            qs = qs.filter(business_id=opts["business_id"])

        customers = list(
            qs.select_related("business").filter(jobs__isnull=False).distinct()
        )
        if not customers:
            self.stdout.write(self.style.WARNING("No customers with bookings to score."))
            return

        self.stdout.write(f"Scoring {len(customers)} customer(s) in batches of {batch_size}…")
        client = MLClient()
        as_of = timezone.now()
        as_of_iso = as_of.isoformat()

        total_written = 0
        for batch in _chunk(customers, batch_size):
            feature_rows: list[dict] = []
            for cust in batch:
                row = build_features_for_customer(cust, as_of=as_of)
                # ChurnRequest.customers requires customer_id — already set.
                feature_rows.append(row)

            try:
                resp = client.predict_churn(feature_rows, as_of=as_of_iso)
            except MLServiceError as exc:
                raise CommandError(f"ML service call failed: {exc}") from exc

            preds = resp.get("predictions", [])
            model_version = resp.get("model_version", "unknown")
            model_name = resp.get("model_name", "unknown")
            feature_set = resp.get("feature_set", "unknown")
            cust_by_id = {c.pk: c for c in batch}
            snap_by_id = {r["customer_id"]: r for r in feature_rows}

            new_rows: list[ChurnScore] = []
            for p in preds:
                cid = p["customer_id"]
                if cid not in cust_by_id:
                    continue
                snapshot = {k: _json_safe(snap_by_id[cid].get(k)) for k in EXT_FEATURES}
                new_rows.append(
                    ChurnScore(
                        customer=cust_by_id[cid],
                        scored_at=as_of,
                        probability=Decimal(str(round(float(p["probability"]), 4))),
                        risk_bucket=p["risk_bucket"],
                        model_version=model_version,
                        model_name=model_name,
                        feature_set=feature_set,
                        feature_snapshot=snapshot,
                    )
                )

            if dry_run:
                self.stdout.write(f"  [dry-run] would write {len(new_rows)} rows")
            else:
                with transaction.atomic():
                    ChurnScore.objects.bulk_create(new_rows, batch_size=batch_size)
            total_written += len(new_rows)

        verb = "would write" if dry_run else "wrote"
        self.stdout.write(self.style.SUCCESS(
            f"Done. {verb} {total_written} ChurnScore rows (model={model_name}, version={model_version})."
        ))
