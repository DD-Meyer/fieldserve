"""demo_retrain_loop — end-to-end smoke test for the churn retraining pipeline.

Intended for interactive validation (dissertation demo). Steps:

1. Snapshot the live ML model version.
2. Seed synthetic ChurnLabel rows from existing ChurnScores if fewer than
   `--min-samples` real labels are available — this bypasses the 180-day
   waiting window so the loop can be exercised in seconds.
3. Run `retrain_churn` to POST features to the ML service and hot-swap.
4. Print the delta (old vs new model version) and the newest RetrainRun row.

Usage:
    python manage.py demo_retrain_loop
    python manage.py demo_retrain_loop --min-samples 20 --clean

`--clean` deletes the synthetic labels (and their RetrainRun link) at the end
so the demo can be re-run without polluting real data.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from analytics.ml_client import MLClient, MLServiceError
from analytics.models import ChurnLabel, ChurnScore, RetrainRun

_DEMO_TAG = {"demo_retrain_loop": True}


class Command(BaseCommand):
    help = "Seed labels if needed, retrain, and verify the model was hot-swapped."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--min-samples", type=int, default=20)
        parser.add_argument("--window-days", type=int, default=180)
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete seeded demo labels after the run.",
        )

    def handle(self, *args, **opts) -> None:
        min_samples = int(opts["min_samples"])
        window_days = int(opts["window_days"])
        client = MLClient()

        # 1. Snapshot the live model.
        try:
            before = client.churn_info()
        except MLServiceError as exc:
            raise CommandError(f"ML service unreachable: {exc}") from exc
        self.stdout.write(self.style.NOTICE("Before retrain:"))
        self._print_info(before)

        # 2. Seed synthetic labels if we don't have enough real ones.
        unused = ChurnLabel.objects.filter(used_in_retrain__isnull=True).count()
        seeded_ids: list[int] = []
        if unused < min_samples:
            need = min_samples - unused
            seeded_ids = self._seed_labels(need, window_days)
            self.stdout.write(
                self.style.WARNING(
                    f"Seeded {len(seeded_ids)} synthetic label(s) (had {unused}, need {min_samples})."
                )
            )
        else:
            self.stdout.write(f"Using {unused} existing unused label(s).")

        # 3. Retrain.
        try:
            from django.core.management import call_command

            call_command("retrain_churn", "--min-samples", str(min_samples))
        except CommandError as exc:
            self.stderr.write(self.style.ERROR(f"retrain_churn failed: {exc}"))
            if opts["clean"] and seeded_ids:
                ChurnLabel.objects.filter(pk__in=seeded_ids).delete()
            raise

        # 4. Verify.
        try:
            after = client.churn_info()
        except MLServiceError as exc:
            raise CommandError(f"ML service unreachable after retrain: {exc}") from exc
        self.stdout.write(self.style.NOTICE("After retrain:"))
        self._print_info(after)

        latest_run = RetrainRun.objects.order_by("-triggered_at").first()
        if latest_run is None:
            self.stderr.write(self.style.ERROR("No RetrainRun row was written!"))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"RetrainRun#{latest_run.pk}: status={latest_run.status}, "
                    f"n_samples={latest_run.n_samples}, model={latest_run.model_name}"
                )
            )

        swapped = before.get("model_version") != after.get("model_version") or before.get(
            "trained_at"
        ) != after.get("trained_at")
        if swapped:
            self.stdout.write(self.style.SUCCESS("✓ Model hot-swap detected."))
        else:
            self.stderr.write(
                self.style.WARNING(
                    "⚠ Model version/trained_at unchanged — hot-swap may have failed."
                )
            )

        if opts["clean"] and seeded_ids:
            with transaction.atomic():
                ChurnLabel.objects.filter(pk__in=seeded_ids).delete()
            self.stdout.write(f"Cleaned {len(seeded_ids)} synthetic label(s).")

    def _seed_labels(self, count: int, window_days: int) -> list[int]:
        """Turn recent ChurnScore rows into ChurnLabels, alternating churn/retain.

        Skips scores whose customer already has a label at that date.
        """
        candidates = list(
            ChurnScore.objects.select_related("customer").order_by("-scored_at")[
                : count * 3
            ]
        )
        seeded: list[ChurnLabel] = []
        seen_pairs: set[tuple[int, object]] = set()
        for i, s in enumerate(candidates):
            if len(seeded) >= count:
                break
            key = (s.customer_id, s.scored_at.date())
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            if ChurnLabel.objects.filter(
                customer=s.customer, cutoff_date=s.scored_at.date()
            ).exists():
                continue
            seeded.append(
                ChurnLabel(
                    customer=s.customer,
                    cutoff_date=s.scored_at.date(),
                    window_days=window_days,
                    churned=(i % 2 == 0),
                    feature_snapshot={**s.feature_snapshot, **_DEMO_TAG},
                )
            )
        if not seeded:
            return []
        with transaction.atomic():
            ChurnLabel.objects.bulk_create(seeded)
        return [lbl.pk for lbl in seeded]

    def _print_info(self, info: dict) -> None:
        for key in ("model_name", "model_version", "feature_set", "trained_at", "mode"):
            self.stdout.write(f"  {key}: {info.get(key)}")
