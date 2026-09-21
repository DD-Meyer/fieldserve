"""
Trains YOLOv8 on CarDD and writes candidate weights plus evaluation metadata.

The active vehicle_damage.py weights are updated only when --promote is set and
the candidate beats the current deployed model by the configured metric gate.

Usage:
    python train_vehicle_damage.py                # convert (if needed) + train
    python train_vehicle_damage.py --skip-convert  # data.yaml already exists
    python train_vehicle_damage.py --epochs 100 --model yolov8s.pt
"""

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from coco_to_yolo import YOLO_ROOT, main as convert_coco_to_yolo

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]

DEFAULT_WEIGHTS_TARGET = PROJECT_ROOT / "ml_service" / "models" / "computer_vision" / "vehicle_damage.pt"
DEFAULT_CANDIDATE_DIR = PROJECT_ROOT / "ml_service" / "models" / "computer_vision" / "candidates"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _metric_dict(metrics) -> dict[str, float]:
    box = metrics.box
    values = {
        "map50_95": float(box.map),
        "map50": float(box.map50),
    }
    for name in ("mp", "mr"):
        value = getattr(box, name, None)
        if value is not None:
            values[name] = float(value)
    return values


def _write_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--model", default="yolov8n.pt", help="yolov8n.pt or yolov8s.pt")
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--project", default="runs")
    p.add_argument("--name", default="cardd")
    p.add_argument("--skip-convert", action="store_true")
    p.add_argument(
        "--data-yaml",
        default=None,
        help="Existing YOLO data.yaml to train against. Skips CarDD conversion when set.",
    )
    p.add_argument(
        "--candidate-dir",
        default=str(DEFAULT_CANDIDATE_DIR),
        help="Directory where candidate weights and manifest files are written.",
    )
    p.add_argument(
        "--baseline-weights",
        default=None,
        help="Current deployed weights to compare against. Defaults to $VEHICLE_DAMAGE_WEIGHTS.",
    )
    p.add_argument(
        "--min-map-delta",
        type=float,
        default=0.0,
        help="Minimum mAP50-95 improvement required before promotion.",
    )
    p.add_argument(
        "--promote",
        action="store_true",
        help="Copy candidate weights to --weights-out only if the metric gate passes.",
    )
    p.add_argument(
        "--weights-out",
        default=None,
        help="Active output path used only with --promote. Defaults to $VEHICLE_DAMAGE_WEIGHTS or "
        f"{DEFAULT_WEIGHTS_TARGET}",
    )
    return p.parse_args()


def main():
    args = parse_args()

    data_yaml = Path(args.data_yaml) if args.data_yaml else YOLO_ROOT / "data.yaml"
    if args.data_yaml is None and (not args.skip_convert or not data_yaml.exists()):
        print("Converting CarDD COCO annotations to YOLO format...")
        convert_coco_to_yolo()
    if not data_yaml.exists():
        raise FileNotFoundError(f"YOLO data.yaml not found: {data_yaml}")

    from ultralytics import YOLO  # imported here so --help works without it installed

    model = YOLO(args.model)
    model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=args.project,
        name=args.name,
    )

    trainer = getattr(model, "trainer", None)
    if trainer is None:
        raise RuntimeError("Ultralytics trainer was not created")

    save_dir = getattr(trainer, "save_dir", None)
    if save_dir is None:
        raise RuntimeError("Could not determine YOLO training output directory")

    run_dir = Path(save_dir)

    best_pt = run_dir / "weights" / "best.pt"
    if not best_pt.exists():
        raise FileNotFoundError(f"Expected {best_pt} but it wasn't produced")

    candidate_dir = Path(args.candidate_dir)
    candidate_dir.mkdir(parents=True, exist_ok=True)
    trained_at = datetime.now(timezone.utc).isoformat()
    candidate_name = f"vehicle_damage_{trained_at.replace(':', '').replace('+', 'Z')}.pt"
    candidate_path = candidate_dir / candidate_name
    shutil.copy2(best_pt, candidate_path)

    candidate_metrics = _metric_dict(model.val(data=str(data_yaml)))
    baseline_path = Path(
        args.baseline_weights
        or os.environ.get("VEHICLE_DAMAGE_WEIGHTS", DEFAULT_WEIGHTS_TARGET)
    )
    baseline_metrics: dict[str, float] = {}
    current_map = None
    if baseline_path.exists():
        baseline_model = YOLO(str(baseline_path))
        baseline_metrics = _metric_dict(baseline_model.val(data=str(data_yaml)))
        current_map = baseline_metrics["map50_95"]

    delta = None if current_map is None else candidate_metrics["map50_95"] - current_map
    accepted = current_map is None or delta >= args.min_map_delta
    decision = "accepted" if accepted else "rejected"
    weights_target = Path(
        args.weights_out or os.environ.get("VEHICLE_DAMAGE_WEIGHTS", DEFAULT_WEIGHTS_TARGET)
    )
    promoted = False
    if args.promote and accepted:
        weights_target.parent.mkdir(parents=True, exist_ok=True)
        tmp = weights_target.with_suffix(weights_target.suffix + ".tmp")
        shutil.copy2(candidate_path, tmp)
        tmp.replace(weights_target)
        promoted = True

    manifest = {
        "trained_at": trained_at,
        "candidate_weights": str(candidate_path),
        "candidate_sha256": _sha256(candidate_path),
        "candidate_metrics": candidate_metrics,
        "baseline_weights": str(baseline_path),
        "baseline_metrics": baseline_metrics,
        "primary_metric": "map50_95",
        "min_map_delta": args.min_map_delta,
        "map_delta": delta,
        "decision": decision,
        "promoted": promoted,
        "active_weights": str(weights_target) if promoted else None,
        "run_dir": str(run_dir),
    }
    manifest_path = candidate_path.with_suffix(".json")
    _write_manifest(manifest_path, manifest)

    print(f"\nCandidate weights: {candidate_path}")
    print(f"Manifest: {manifest_path}")
    print(
        "candidate mAP50-95: "
        f"{candidate_metrics['map50_95']:.4f}  mAP50: {candidate_metrics['map50']:.4f}"
    )
    if baseline_metrics:
        print(
            "baseline  mAP50-95: "
            f"{baseline_metrics['map50_95']:.4f}  delta: {delta:.4f}"
        )
    print(f"decision: {decision}; promoted={promoted}")


if __name__ == "__main__":
    main()