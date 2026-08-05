"""Tests for MLClient using httpx.MockTransport."""

from __future__ import annotations

import json

import httpx
import pytest
from django.test import override_settings

from analytics.ml_client import MLClient, MLServiceError


@override_settings(ML_SERVICE_URL="http://ml.test", ML_INTERNAL_TOKEN="tok")
def test_predict_churn_returns_parsed_body():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/predict/churn"
        payload = json.loads(request.content)
        assert payload["customers"][0]["customer_id"] == 42
        return httpx.Response(
            200,
            json={
                "predictions": [
                    {"customer_id": 42, "probability": 0.42, "risk_bucket": "Medium"},
                ],
                "model_version": "v1",
                "model_name": "test-rf",
                "feature_set": "ext-v1",
            },
        )

    transport = httpx.MockTransport(handler)
    client = MLClient()
    # Monkey-patch the internal Client factory to inject our transport.
    import analytics.ml_client as mod

    original_client = mod.httpx.Client

    def mocked_client(*args, **kwargs):
        return original_client(*args, **{**kwargs, "transport": transport})

    mod.httpx.Client = mocked_client  # type: ignore[assignment]
    try:
        resp = client.predict_churn([{"customer_id": 42}], as_of="2026-01-01T00:00:00")
    finally:
        mod.httpx.Client = original_client  # type: ignore[assignment]

    assert resp["model_version"] == "v1"
    assert resp["predictions"][0]["risk_bucket"] == "Medium"


@override_settings(ML_SERVICE_URL="http://ml.test", ML_INTERNAL_TOKEN=None)
def test_admin_call_without_token_raises():
    client = MLClient()
    with pytest.raises(MLServiceError, match="ML_INTERNAL_TOKEN"):
        client.reload_model()


@override_settings(ML_SERVICE_URL="http://ml.test", ML_INTERNAL_TOKEN="tok")
def test_non_2xx_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    transport = httpx.MockTransport(handler)
    client = MLClient()
    import analytics.ml_client as mod

    original_client = mod.httpx.Client
    mod.httpx.Client = lambda *a, **kw: original_client(  # type: ignore[assignment]
        *a, **{**kw, "transport": transport}
    )
    try:
        with pytest.raises(MLServiceError):
            client.churn_info()
    finally:
        mod.httpx.Client = original_client  # type: ignore[assignment]
