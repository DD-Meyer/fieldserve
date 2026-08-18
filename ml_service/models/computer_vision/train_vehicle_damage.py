"""
Trains YOLOv8 on CarDD and drops the resulting weights at the exact path
vehicle_damage.py expects (ml_service/models/vehicle_damage.pt, or wherever
VEHICLE_DAMAGE_WEIGHTS points).

Usage:
    python train_vehicle_damage.py                # convert (if needed) + train
    python train_vehicle_damage.py --skip-convert  # data.yaml already exists
    python train_vehicle_damage.py --epochs 100 --model yolov8s.pt
"""

import argparse
import os
import shutil
from pathlib import Path

from coco_to_yolo import YOLO_ROOT, main as convert_coco_to_yolo

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]

DEFAULT_WEIGHTS_TARGET = PROJECT_ROOT / "ml_service" / "models" / "computer_vision" / "vehicle_damage.pt"


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
        "--weights-out",
        default=None,
        help="Override output path. Defaults to $VEHICLE_DAMAGE_WEIGHTS or "
        f"{DEFAULT_WEIGHTS_TARGET}",
    )
    return p.parse_args()


def main():
    args = parse_args()

    data_yaml = YOLO_ROOT / "data.yaml"
    if not args.skip_convert or not data_yaml.exists():
        print("Converting CarDD COCO annotations to YOLO format...")
        convert_coco_to_yolo()

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

    weights_target = Path(
        args.weights_out or os.environ.get("VEHICLE_DAMAGE_WEIGHTS", DEFAULT_WEIGHTS_TARGET)
    )
    weights_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_pt, weights_target)
    print(f"\nCopied {best_pt} -> {weights_target}")

    # quick sanity check on the validation split
    metrics = model.val(data=str(data_yaml))
    print(f"val mAP50-95: {metrics.box.map:.4f}  mAP50: {metrics.box.map50:.4f}")


if __name__ == "__main__":
    main()