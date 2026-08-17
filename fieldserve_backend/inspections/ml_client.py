"""Thin HTTP client for the FastAPI vehicle-damage endpoint.

Isolated behind a `detect_damage()` function so views don't couple to
`requests` semantics and tests can monkey-patch a single symbol.
"""

from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

log = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 30


class DamageServiceError(Exception):
    pass


def detect_damage(image_bytes: bytes, filename: str = "photo.jpg") -> dict[str, Any]:
    """Return the ml_service `/vision/detect-damage` payload or raise.

    Response shape (as of ml_service v0.2.x):
        { "damages": [ {label, confidence, bbox:[x1,y1,x2,y2]}, ... ],
          "model_version": "yolov8n-cardd-<hash> | fallback-stub" }
    """
    url = f"{settings.ML_SERVICE_URL.rstrip('/')}/vision/detect-damage"
    files = {"image": (filename, image_bytes, "image/jpeg")}
    try:
        resp = requests.post(url, files=files, timeout=_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise DamageServiceError(f"ml_service unreachable: {exc}") from exc
    if resp.status_code >= 400:
        raise DamageServiceError(
            f"ml_service returned {resp.status_code}: {resp.text[:200]}"
        )
    try:
        return resp.json()
    except ValueError as exc:
        raise DamageServiceError("ml_service returned non-JSON body") from exc


def check_vehicle_frame(image_bytes: bytes, filename: str = "frame.jpg") -> dict[str, Any]:
    url = f"{settings.ML_SERVICE_URL.rstrip('/')}/vision/check-frame"
    files = {"image": (filename, image_bytes, "image/jpeg")}
    try:
        response = requests.post(url, files=files, timeout=_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise DamageServiceError(f"ml_service unreachable: {exc}") from exc
    if response.status_code >= 400:
        raise DamageServiceError(
            f"ml_service returned {response.status_code}: {response.text[:200]}"
        )
    try:
        return response.json()
    except ValueError as exc:
        raise DamageServiceError("ml_service returned non-JSON body") from exc
