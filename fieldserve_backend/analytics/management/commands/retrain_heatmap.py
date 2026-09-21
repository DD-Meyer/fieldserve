"""Train the forecast heatmap bundle from live customer/job geodata."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from analytics.ml_client import MLClient, MLServiceError
from jobs.models import Job
from users.models import Customer


def _point_to_latlng(point) -> tuple[float, float] | None:
    if point is None:
        return None
    return (float(point.y), float(point.x))


class Command(BaseCommand):
    help = "Train and promote the heatmap forecast model from live geodata."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--business-id", type=int, default=None)
        parser.add_argument("--min-samples", type=int, default=20)
        parser.add_argument("--min-delta", type=float, default=0.0)

    def handle(self, *args, **opts) -> None:
        business_id = opts["business_id"]
        min_samples = int(opts["min_samples"])
        min_delta = float(opts["min_delta"])

        rows = self._build_rows(business_id=business_id)
        if len(rows) < min_samples:
            self.stdout.write(
                self.style.WARNING(
                    f"Only {len(rows)} geo point(s) available; need >= {min_samples}. Skipping."
                )
            )
            return

        try:
            result = MLClient().train_heatmap(
                rows,
                data_source="django-customers-jobs",
                min_samples=min_samples,
                min_log_likelihood_delta=min_delta,
            )
        except MLServiceError as exc:
            raise CommandError(f"Heatmap train call failed: {exc}") from exc

        status = "promoted" if result.get("promoted") else "rejected"
        self.stdout.write(
            self.style.SUCCESS(
                f"Heatmap forecast candidate {status}: n={result.get('n_samples')}, "
                f"bandwidth={result.get('bandwidth')}, metrics={result.get('metrics')}, "
                f"reason={result.get('reason')}"
            )
        )

    def _build_rows(self, *, business_id: int | None = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []

        customers = Customer.objects.filter(location__isnull=False)
        if business_id is not None:
            customers = customers.filter(business_id=business_id)
        for customer in customers.only("id", "business_id", "location", "created_at"):
            latlng = _point_to_latlng(customer.location)
            if latlng is None:
                continue
            rows.append(
                {
                    "latitude": latlng[0],
                    "longitude": latlng[1],
                    "weight": 1.0,
                    "observed_at": customer.created_at.isoformat(),
                    "source": "customer",
                }
            )

        jobs = Job.objects.filter(location__isnull=False, status=Job.Status.COMPLETED)
        if business_id is not None:
            jobs = jobs.filter(business_id=business_id)
        for job in jobs.only("id", "business_id", "location", "scheduled_at", "completed_at", "price"):
            latlng = _point_to_latlng(job.location)
            if latlng is None:
                continue
            observed_at = job.completed_at or job.scheduled_at
            rows.append(
                {
                    "latitude": latlng[0],
                    "longitude": latlng[1],
                    "weight": max(float(job.price or 1.0), 0.01),
                    "observed_at": observed_at.isoformat(),
                    "source": "completed_job",
                }
            )
        return rows