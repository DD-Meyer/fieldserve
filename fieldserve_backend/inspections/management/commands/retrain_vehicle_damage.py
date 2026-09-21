"""Export approved annotations and trigger gated YOLO retraining."""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from analytics.ml_client import MLClient, MLServiceError
from inspections.models import DamageAnnotation


class Command(BaseCommand):
    help = "Train/promote the vehicle-damage YOLO model from approved annotations."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--export-out", default="/exports/vehicle_damage_yolo")
        parser.add_argument("--ml-data-yaml", default="/exports/vehicle_damage_yolo/data.yaml")
        parser.add_argument("--min-annotations", type=int, default=20)
        parser.add_argument("--epochs", type=int, default=50)
        parser.add_argument("--imgsz", type=int, default=640)
        parser.add_argument("--batch", type=int, default=16)
        parser.add_argument("--model", default="yolov8n.pt")
        parser.add_argument("--min-map-delta", type=float, default=0.0)
        parser.add_argument("--no-promote", action="store_true")
        parser.add_argument("--timeout-seconds", type=int, default=7200)

    def handle(self, *args, **opts) -> None:
        approved_count = DamageAnnotation.objects.filter(approved=True).count()
        min_annotations = int(opts["min_annotations"])
        if approved_count < min_annotations:
            self.stdout.write(
                self.style.WARNING(
                    f"Only {approved_count} approved annotation(s); need >= {min_annotations}. Skipping."
                )
            )
            return

        call_command("export_damage_yolo", "--out", opts["export_out"], "--include-exported")

        try:
            result = MLClient().train_vehicle_damage(
                data_yaml=opts["ml_data_yaml"],
                epochs=int(opts["epochs"]),
                imgsz=int(opts["imgsz"]),
                batch=int(opts["batch"]),
                model=opts["model"],
                min_map_delta=float(opts["min_map_delta"]),
                promote=not bool(opts["no_promote"]),
                timeout_seconds=int(opts["timeout_seconds"]),
            )
        except MLServiceError as exc:
            raise CommandError(f"Vehicle damage train call failed: {exc}") from exc

        if result.get("returncode") != 0:
            raise CommandError(
                "Vehicle damage training failed: "
                f"stderr={result.get('stderr')} stdout={result.get('stdout')}"
            )

        manifest = result.get("manifest") or {}
        self.stdout.write(
            self.style.SUCCESS(
                f"Vehicle damage training complete: decision={manifest.get('decision')}, "
                f"promoted={manifest.get('promoted')}, metrics={manifest.get('candidate_metrics')}"
            )
        )