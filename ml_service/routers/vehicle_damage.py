"""Vehicle damage detection endpoint.

Loads a YOLOv8 model at import time if the weights file exists AND
ultralytics is installed. Otherwise serves a deterministic stub so the
rest of the pipeline (Django → ml_service → mobile) can be exercised
end-to-end while the CarDD fine-tune trains.

The damage model reports findings; a separate generic detector validates
vehicle framing for guided auto-capture.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

log = logging.getLogger(__name__)
router = APIRouter(tags=["vision"], prefix="/vision")


CARDD_LABELS = [
    "dent",
    "scratch",
    "crack",
    "glass_shatter",
    "lamp_broken",
    "tire_flat",
]

WEIGHTS_PATH = Path(os.environ.get(
    "VEHICLE_DAMAGE_WEIGHTS",
    Path(__file__).resolve().parent.parent
    / "models"
    / "computer_vision"
    / "vehicle_damage.pt",
))
FRAME_WEIGHTS_PATH = Path(os.environ.get(
    "VEHICLE_FRAME_WEIGHTS",
    Path(__file__).resolve().parent.parent
    / "models"
    / "computer_vision"
    / "yolov8n.pt",
))
VEHICLE_LABELS = {"car", "truck", "bus", "motorcycle"}


class _Model:
    """Wraps YOLOv8 with a stub fallback so both code paths share one API."""

    def __init__(self) -> None:
        self.impl = None
        self.version = "fallback-stub"
        self._try_load()

    def _try_load(self) -> None:
        if not WEIGHTS_PATH.exists():
            log.warning(
                "Vehicle damage weights not found at %s — serving fallback stub.",
                WEIGHTS_PATH,
            )
            return
        try:
            from ultralytics import YOLO  # type: ignore

            self.impl = YOLO(str(WEIGHTS_PATH))
            sha = hashlib.sha256(WEIGHTS_PATH.read_bytes()).hexdigest()[:7]
            self.version = f"yolov8n-cardd-{sha}"
            log.info("Loaded vehicle damage model %s", self.version)
        except ImportError as exc:
            log.warning("Ultralytics import failed: %s — serving fallback stub.", exc)
        except Exception:  # noqa: BLE001
            log.exception("Failed to load vehicle damage model — serving fallback stub.")

    def predict(self, image: Image.Image) -> list[dict[str, Any]]:
        if self.impl is None:
            return self._stub(image)
        try:
            results = self.impl.predict(image, verbose=False)
        except Exception:  # noqa: BLE001
            log.exception("YOLO inference failed — returning empty damage list.")
            return []
        damages: list[dict[str, Any]] = []
        for r in results:
            boxes = getattr(r, "boxes", None)
            if boxes is None:
                continue
            names = getattr(r, "names", {}) or {}
            xyxy = boxes.xyxy.tolist() if hasattr(boxes.xyxy, "tolist") else []
            confs = boxes.conf.tolist() if hasattr(boxes.conf, "tolist") else []
            clss = boxes.cls.tolist() if hasattr(boxes.cls, "tolist") else []
            for box, conf, cls in zip(xyxy, confs, clss):
                label = names.get(int(cls), CARDD_LABELS[int(cls) % len(CARDD_LABELS)])
                damages.append(
                    {
                        "label": label,
                        "confidence": round(float(conf), 3),
                        "bbox": [round(float(v), 1) for v in box],
                    }
                )
        return damages

    def _stub(self, image: Image.Image) -> list[dict[str, Any]]:
        """Deterministic pseudo-detection based on image hash.

        Not for evaluation — purely to unblock the mobile / Django integration
        while the CarDD fine-tune runs. Emits 0–2 fake boxes on the right side
        of the image with a stable label picked from the hash.
        """
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=70)
        digest = hashlib.sha256(buf.getvalue()).hexdigest()
        n_boxes = int(digest[0], 16) % 3  # 0, 1 or 2
        if n_boxes == 0:
            return []
        w, h = image.size
        damages: list[dict[str, Any]] = []
        for i in range(n_boxes):
            label = CARDD_LABELS[int(digest[i + 1], 16) % len(CARDD_LABELS)]
            x1 = int(w * 0.5)
            y1 = int(h * (0.2 + i * 0.3))
            damages.append(
                {
                    "label": label,
                    "confidence": 0.42 + i * 0.05,
                    "bbox": [x1, y1, x1 + int(w * 0.2), y1 + int(h * 0.15)],
                }
            )
        return damages


_MODEL = _Model()


class _FrameModel:
    def __init__(self) -> None:
        self.impl = None
        if not FRAME_WEIGHTS_PATH.exists():
            log.warning("Vehicle framing weights not found at %s", FRAME_WEIGHTS_PATH)
            return
        try:
            from ultralytics import YOLO  # type: ignore

            self.impl = YOLO(str(FRAME_WEIGHTS_PATH))
        except Exception:  # noqa: BLE001
            log.exception("Failed to load vehicle framing model")

    def check(self, image: Image.Image) -> dict[str, Any]:
        if self.impl is None:
            return {"ready": False, "reason": "detector_unavailable", "guidance": "Use manual capture"}
        results = self.impl.predict(image, verbose=False, conf=0.3)
        result = results[0]
        candidates = []
        for box, confidence, class_id in zip(result.boxes.xyxy, result.boxes.conf, result.boxes.cls):
            label = result.names[int(class_id)]
            if label not in VEHICLE_LABELS:
                continue
            coordinates = [float(value) for value in box]
            area = max(0.0, coordinates[2] - coordinates[0]) * max(0.0, coordinates[3] - coordinates[1])
            candidates.append((area, float(confidence), label, coordinates))
        if not candidates:
            return {"ready": False, "reason": "no_vehicle", "guidance": "Point the camera at the vehicle"}

        _, confidence, label, bbox = max(candidates, key=lambda item: item[0])
        width, height = image.size
        x1, y1, x2, y2 = bbox
        coverage = ((x2 - x1) * (y2 - y1)) / (width * height)
        center_x = ((x1 + x2) / 2) / width
        center_y = ((y1 + y2) / 2) / height
        clipped = x1 <= width * 0.015 or y1 <= height * 0.015 or x2 >= width * 0.985 or y2 >= height * 0.985

        reason = "ready"
        guidance = "Hold steady"
        if clipped or coverage > 0.82:
            reason, guidance = "too_close", "Move back until the whole vehicle is visible"
        elif coverage < 0.24:
            reason, guidance = "too_far", "Move closer to the vehicle"
        elif center_x < 0.38:
            reason, guidance = "move_left", "Move the camera left"
        elif center_x > 0.62:
            reason, guidance = "move_right", "Move the camera right"
        elif center_y < 0.34:
            reason, guidance = "move_up", "Raise the vehicle in the frame"
        elif center_y > 0.70:
            reason, guidance = "move_down", "Lower the vehicle in the frame"

        return {
            "ready": reason == "ready",
            "reason": reason,
            "guidance": guidance,
            "vehicle": {
                "label": label,
                "confidence": round(confidence, 3),
                "bbox": [round(value, 1) for value in bbox],
                "coverage": round(coverage, 3),
                "center": [round(center_x, 3), round(center_y, 3)],
                "clipped": clipped,
            },
        }


_FRAME_MODEL = _FrameModel()


def _region_for_bbox(bbox: list[float], width: int, height: int) -> str:
    center_x = ((bbox[0] + bbox[2]) / 2) / width
    center_y = ((bbox[1] + bbox[3]) / 2) / height
    horizontal = "left" if center_x < 1 / 3 else "right" if center_x > 2 / 3 else "centre"
    vertical = "upper" if center_y < 1 / 3 else "lower" if center_y > 2 / 3 else "middle"
    return f"{vertical} {horizontal}"


def _damage_report(damages: list[dict[str, Any]], width: int, height: int) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for damage in damages:
        bbox = damage["bbox"]
        area = max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])
        confidence = damage["confidence"]
        damage["region"] = _region_for_bbox(bbox, width, height)
        damage["area_percent"] = round((area / (width * height)) * 100, 1)
        damage["confidence_band"] = "high" if confidence >= 0.75 else "medium" if confidence >= 0.5 else "low"
        counts[damage["label"]] = counts.get(damage["label"], 0) + 1
    return {
        "total": len(damages),
        "counts_by_type": counts,
        "highest_confidence": round(max((item["confidence"] for item in damages), default=0.0), 3),
    }


@router.post("/detect-damage")
async def detect_damage(image: UploadFile = File(...)) -> dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Expected an image file.")
    try:
        raw = await image.read()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Could not decode image.")
    damages = _MODEL.predict(img)
    return {
        "damages": damages,
        "summary": _damage_report(damages, img.width, img.height),
        "model_version": _MODEL.version,
        "image_size": {"width": img.width, "height": img.height},
    }


@router.post("/check-frame")
async def check_frame(image: UploadFile = File(...)) -> dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Expected an image file.")
    try:
        raw = await image.read()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Could not decode image.")
    return _FRAME_MODEL.check(img)


@router.get("/status")
def status() -> dict[str, Any]:
    return {
        "loaded": _MODEL.impl is not None,
        "model_version": _MODEL.version,
        "weights_path": str(WEIGHTS_PATH),
        "weights_present": WEIGHTS_PATH.exists(),
    }
