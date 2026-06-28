"""label_churn — compute ground-truth churn labels once the window has elapsed.

For each ChurnScore older than `window_days`, check whether the customer had
any completed job in `[scored_at, scored_at + window_days]`. If not → churned.

Usage:
    python manage.py label_churn                  # default 180-day window
    python manage.py label_churn --window-days 90
    python manage.py label_churn --dry-run
"""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from analytics.models import ChurnLabel, ChurnScore
from jobs.models import Job


class Command(BaseCommand):
    help = "Create ChurnLabel rows for ChurnScores whose churn window has elapsed."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--window-days", type=int, default=180)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts) -> None:
        window_days = int(opts["window_days"])
        dry_run = bool(opts["dry_run"])
        cutoff_threshold = timezone.now() - timedelta(days=window_days)

        # All scores whose window has fully elapsed and have no label yet.
        already_labelled = ChurnLabel.objects.filter(
            customer=OuterRef("customer"),
            cutoff_date=OuterRef("scored_at__date"),
            window_days=window_days,
        )
        scores = (
            ChurnScore.objects.filter(scored_at__lte=cutoff_threshold)
            .annotate(has_label=Exists(already_labelled))
            .filter(has_label=False)
            .select_related("customer")
        )

        if not scores.exists():
            self.stdout.write(self.style.WARNING(
                f"No unlabelled scores older than {window_days} days."
            ))
            return

        new_labels: list[ChurnLabel] = []
        for score in scores:
            window_end = score.scored_at + timedelta(days=window_days)
            returned = Job.objects.filter(
                customer=score.customer,
                status=Job.Status.COMPLETED,
                completed_at__gte=score.scored_at,
                completed_at__lt=window_end,
            ).exists()
            new_labels.append(
                ChurnLabel(
                    customer=score.customer,
                    cutoff_date=score.scored_at.date(),
                    window_days=window_days,
                    churned=not returned,
                    feature_snapshot=score.feature_snapshot,
                )
            )

        if dry_run:
            self.stdout.write(f"[dry-run] would write {len(new_labels)} labels")
            return

        with transaction.atomic():
            # `ignore_conflicts` covers the rare race where another run beat us.
            ChurnLabel.objects.bulk_create(new_labels, ignore_conflicts=True)

        churned = sum(1 for l in new_labels if l.churned)
        self.stdout.write(self.style.SUCCESS(
            f"Wrote {len(new_labels)} ChurnLabel rows ({churned} churned, "
            f"{len(new_labels) - churned} retained)."
        ))
