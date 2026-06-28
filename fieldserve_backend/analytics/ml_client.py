"""Thin HTTP wrapper around the FastAPI ML service.

Centralises retry/timeout choices, request shaping, and auth-header handling
so views and management commands stay declarative.

Usage:
    client = MLClient()
    resp = client.predict_churn(rows, as_of=timezone.now())
    client.reload_model()  # after a successful retrain
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


class MLServiceError(RuntimeError):
    """Raised when the ML service returns a non-2xx response or is unreachable."""


class MLClient:
    def __init__(self, base_url: str | None = None, internal_token: str | None = None) -> None:
        self.base_url = (base_url or settings.ML_SERVICE_URL or "").rstrip("/")
        self.internal_token = internal_token or settings.ML_INTERNAL_TOKEN
        if not self.base_url:
            raise MLServiceError("ML_SERVICE_URL is not configured.")

    # ---- public endpoints ------------------------------------------------

    def predict_churn(
        self,
        customers: list[dict[str, Any]],
        *,
        as_of: str | None = None,
    ) -> dict[str, Any]:
        """POST /predict/churn — returns the parsed JSON body."""
        payload: dict[str, Any] = {"customers": customers}
        if as_of is not None:
            payload["as_of"] = as_of
        return self._post("/predict/churn", payload)

    def churn_info(self) -> dict[str, Any]:
        """GET /predict/churn/info — diagnostic metadata for the live bundle."""
        return self._get("/predict/churn/info")

    # ---- admin (token-gated) ---------------------------------------------

    def train_from_features(
        self,
        rows: list[dict[str, Any]],
        *,
        data_source: str = "django-analytics",
    ) -> dict[str, Any]:
        """POST /admin/train/from_features — kicks off a retrain on the ML service."""
        return self._post(
            "/admin/train/from_features",
            {"data_source": data_source, "rows": rows},
            admin=True,
        )

    def reload_model(self) -> dict[str, Any]:
        """POST /admin/reload — hot-swap the in-memory model on the ML service."""
        return self._post("/admin/reload", {}, admin=True)

    # ---- internals -------------------------------------------------------

    def _headers(self, admin: bool) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if admin:
            if not self.internal_token:
                raise MLServiceError(
                    "ML_INTERNAL_TOKEN is not set; cannot call admin endpoints."
                )
            headers["X-Internal-Token"] = self.internal_token
        return headers

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        log.debug("ML GET %s", url)
        try:
            with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
                resp = client.get(url, headers=self._headers(admin=False))
        except httpx.RequestError as exc:
            raise MLServiceError(f"GET {url} failed: {exc}") from exc
        if resp.status_code >= 400:
            raise MLServiceError(f"GET {url} → {resp.status_code}: {resp.text}")
        return resp.json()

    def _post(self, path: str, payload: dict[str, Any], *, admin: bool = False) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        log.debug("ML POST %s (admin=%s)", url, admin)
        try:
            with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=self._headers(admin))
        except httpx.RequestError as exc:
            raise MLServiceError(f"POST {url} failed: {exc}") from exc
        if resp.status_code >= 400:
            raise MLServiceError(f"POST {url} → {resp.status_code}: {resp.text}")
        return resp.json()
