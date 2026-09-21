"""Export approved damage annotations to YOLO training format."""

from __future__ import annotations

import shutil
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from inspections.models import DAMAGE_LABEL_CHOICES, DamageAnnotation


LABELS = [value for value, _ in DAMAGE_LABEL_CHOICES]
LABEL_TO_INDEX = {label: index for index, label in enumerate(LABELS)}


class Command(BaseCommand):
    help = "Export approved inspection damage annotations to a YOLO dataset."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--out", default="/app/exports/vehicle_damage_yolo")
        parser.add_argument("--include-exported", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts) -> None:
        out_dir = Path(opts["out"])
        dry_run = bool(opts["dry_run"])
        include_exported = bool(opts["include_exported"])

        qs = DamageAnnotation.objects.select_related("inspection").filter(approved=True)
        if not include_exported:
            qs = qs.filter(exported_at__isnull=True)
        annotations = list(qs.order_by("inspection_id"))
        if not annotations:
            self.stdout.write(self.style.WARNING("No approved damage annotations to export."))
            return

        exported_ids: list[int] = []
        for annotation in annotations:
            try:
                image_name, lines = self._build_yolo_item(annotation)
            except Exception as exc:  # noqa: BLE001
                raise CommandError(f"Could not export annotation {annotation.pk}: {exc}") from exc

            split = annotation.split
            image_dir = out_dir / "images" / split
            label_dir = out_dir / "labels" / split
            image_dir.mkdir(parents=True, exist_ok=True)
            label_dir.mkdir(parents=True, exist_ok=True)
            image_path = image_dir / image_name
            label_path = label_dir / f"{Path(image_name).stem}.txt"

            if not dry_run:
                with annotation.inspection.photo.open("rb") as source:
                    with image_path.open("wb") as target:
                        shutil.copyfileobj(source, target)
                label_path.write_text("\n".join(lines) + ("\n" if lines else ""))
                exported_ids.append(annotation.pk)

        if not dry_run:
            self._write_data_yaml(out_dir)
            DamageAnnotation.objects.filter(pk__in=exported_ids).update(exported_at=timezone.now())

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Would export' if dry_run else 'Exported'} {len(annotations)} annotation(s) to {out_dir}"
            )
        )

    def _build_yolo_item(self, annotation: DamageAnnotation) -> tuple[str, list[str]]:
        image_size = annotation.inspection.analysis.get("image_size") if isinstance(annotation.inspection.analysis, dict) else None
        if not image_size:
            raise ValueError("inspection analysis does not include image_size; re-run analysis before export")
        width = int(image_size["width"])
        height = int(image_size["height"])
        image_name = f"inspection_{annotation.inspection_id}{Path(annotation.inspection.photo.name).suffix or '.jpg'}"
        lines: list[str] = []
        for box in annotation.boxes:
            label = box["label"]
            if label not in LABEL_TO_INDEX:
                continue
            x1, y1, x2, y2 = [float(value) for value in box["bbox"]]
            x1 = min(max(x1, 0.0), width)
            x2 = min(max(x2, 0.0), width)
            y1 = min(max(y1, 0.0), height)
            y2 = min(max(y2, 0.0), height)
            if x2 <= x1 or y2 <= y1:
                continue
            x_center = ((x1 + x2) / 2) / width
            y_center = ((y1 + y2) / 2) / height
            box_width = (x2 - x1) / width
            box_height = (y2 - y1) / height
            lines.append(
                f"{LABEL_TO_INDEX[label]} {x_center:.6f} {y_center:.6f} {box_width:.6f} {box_height:.6f}"
            )
        return image_name, lines

    def _write_data_yaml(self, out_dir: Path) -> None:
        lines = [
            f"path: {out_dir.resolve()}",
            "train: images/train",
            "val: images/val",
            "test: images/test",
            f"nc: {len(LABELS)}",
            "names:",
        ] + [f"  {index}: {label}" for index, label in enumerate(LABELS)]
        (out_dir / "data.yaml").write_text("\n".join(lines) + "\n")