"""retrain_churn — ship labelled features to the ML service and hot-swap.

Workflow:
    1. Gather all ChurnLabel rows not yet consumed by a retrain run.
    2. POST them to ML /admin/train/from_features (server-side bake-off).
    3. POST /admin/reload to swap the live model in place.
    4. Record outcome in RetrainRun and mark labels as used.

Usage:
    python manage.py retrain_churn
    python manage.py retrain_churn --min-samples 100
    python manage.py retrain_churn --include-used  # for backfill / debugging
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from analytics.feature_builder import EXT_FEATURES
from analytics.ml_client import MLClient, MLServiceError
from analytics.models import ChurnLabel, RetrainRun


class Command(BaseCommand):
    help = "Retrain the churn model on accumulated ChurnLabel data and hot-swap it."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--triggered-by", default="cron")
        parser.add_argument("--min-samples", type=int, default=50)
        parser.add_argument(
            "--include-used",
            action="store_true",
            help="Include labels already consumed by a previous retrain.",
        )
        parser.add_argument(
            "--no-reload",
            action="store_true",
            help="Train but skip the /admin/reload call (manual swap).",
        )

    def handle(self, *args, **opts) -> None:
        min_samples = int(opts["min_samples"])

        qs = ChurnLabel.objects.all()
        if not opts["include_used"]:
            qs = qs.filter(used_in_retrain__isnull=True)
        labels = list(qs)

        if len(labels) < min_samples:
            self.stdout.write(self.style.WARNING(
                f"Only {len(labels)} label(s) available; need >= {min_samples}. Skipping."
            ))
            return

        rows = [
            {
                **{k: lbl.feature_snapshot.get(k) for k in EXT_FEATURES},
                "churned": int(lbl.churned),
            }
            for lbl in labels
        ]

        run = RetrainRun.objects.create(
            triggered_by=opts["triggered_by"],
            n_samples=len(rows),
            status=RetrainRun.Status.RUNNING,
        )
        self.stdout.write(f"Started RetrainRun#{run.pk} with {len(rows)} samples…")

        client = MLClient()
        try:
            result = client.train_from_features(rows, data_source=f"django-retrain#{run.pk}")
        except MLServiceError as exc:
            run.status = RetrainRun.Status.FAILED
            run.error_message = str(exc)
            run.finished_at = timezone.now()
            run.save(update_fields=["status", "error_message", "finished_at"])
            raise CommandError(f"Train call failed: {exc}") from exc

        run.model_name = result.get("model_name", "")
        run.metrics = result.get("metrics", {})
        run.artefact_path = result.get("artefact_path", "")
        run.status = RetrainRun.Status.SUCCEEDED
        run.finished_at = timezone.now()
        run.save(update_fields=["model_name", "metrics", "artefact_path", "status", "finished_at"])

        with transaction.atomic():
            ChurnLabel.objects.filter(pk__in=[l.pk for l in labels]).update(used_in_retrain=run)

        self.stdout.write(self.style.SUCCESS(
            f"Trained {run.model_name} on {run.n_samples} samples — metrics={run.metrics}"
        ))

        if opts["no_reload"]:
            self.stdout.write("(--no-reload set; live model NOT hot-swapped.)")
            return

        try:
            swap = client.reload_model()
        except MLServiceError as exc:
            self.stdout.write(self.style.ERROR(
                f"Train succeeded but reload failed: {exc}. Run /admin/reload manually."
            ))
            return
        self.stdout.write(self.style.SUCCESS(
            f"Hot-swap complete — mode={swap.get('mode')}, trained_at={swap.get('trained_at')}"
        ))
