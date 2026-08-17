"""Tests for the inspections app.

We patch the ml_service HTTP call so the test suite doesn't require the
FastAPI container to be running.
"""

from __future__ import annotations

import io
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from businesses.models import Business, Membership
from inspections.models import Inspection
from jobs.models import Job
from users.models import Customer

pytestmark = pytest.mark.django_db


def _tiny_jpeg() -> bytes:
    img = Image.new("RGB", (64, 64), color=(200, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _oversized_jpeg() -> bytes:
    return _tiny_jpeg() + b"\0" * (8 * 1024 * 1024)


@pytest.fixture
def job(business, user) -> Job:
    customer = Customer.objects.create(
        business=business, full_name="Test Customer", email="cust@example.com"
    )
    return Job.objects.create(
        business=business,
        customer=customer,
        assigned_to=user,
        service_type="Test Service",
        scheduled_at=timezone.now() + timedelta(days=1),
        duration_minutes=30,
        price=Decimal("50.00"),
    )


@patch("inspections.serializers.detect_damage")
def test_create_inspection_uploads_photo_and_runs_analysis(
    mock_detect, api_client_auth, job
):
    mock_detect.return_value = {
        "damages": [
            {"label": "dent", "confidence": 0.87, "bbox": [10, 20, 40, 50]}
        ],
        "model_version": "yolov8n-cardd-stub",
    }
    photo = SimpleUploadedFile("front.jpg", _tiny_jpeg(), content_type="image/jpeg")
    resp = api_client_auth.post(
        "/api/inspections/",
        {"job": job.id, "phase": "before", "angle": "front", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    row = Inspection.objects.get(pk=resp.data["id"])
    assert row.analysis_status == Inspection.AnalysisStatus.DONE
    assert row.analysis["damages"][0]["label"] == "dent"
    assert row.damage_count == 1
    mock_detect.assert_called_once()


@patch("inspections.serializers.detect_damage")
def test_ml_failure_still_persists_inspection(mock_detect, api_client_auth, job):
    from inspections.ml_client import DamageServiceError

    mock_detect.side_effect = DamageServiceError("boom")
    photo = SimpleUploadedFile("rear.jpg", _tiny_jpeg(), content_type="image/jpeg")
    resp = api_client_auth.post(
        "/api/inspections/",
        {"job": job.id, "phase": "before", "angle": "rear", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 201
    row = Inspection.objects.get(pk=resp.data["id"])
    assert row.analysis_status == Inspection.AnalysisStatus.FAILED
    assert "boom" in row.analysis_error


@patch("inspections.serializers.detect_damage")
def test_cannot_attach_inspection_to_other_business_job(
    mock_detect, api_client_auth, business, job
):
    mock_detect.return_value = {"damages": [], "model_version": "stub"}
    other = Business.objects.create(
        owner=business.owner, name="Other Co", slug="other-co"
    )
    other_customer = Customer.objects.create(
        business=other, full_name="Someone Else", email="e@e.com"
    )
    foreign_job = Job.objects.create(
        business=other,
        customer=other_customer,
        service_type="X",
        scheduled_at=timezone.now() + timedelta(days=1),
        duration_minutes=30,
    )
    photo = SimpleUploadedFile("x.jpg", _tiny_jpeg(), content_type="image/jpeg")
    resp = api_client_auth.post(
        "/api/inspections/",
        {"job": foreign_job.id, "phase": "before", "angle": "front", "photo": photo},
        format="multipart",
    )
    assert resp.status_code == 403


@patch("inspections.serializers.detect_damage")
def test_cannot_retrieve_other_business_inspection(
    mock_detect, api_client_auth, business, job
):
    mock_detect.return_value = {"damages": [], "model_version": "stub"}
    other = Business.objects.create(
        owner=business.owner, name="Other Retrieval Co", slug="other-retrieval-co"
    )
    other_customer = Customer.objects.create(
        business=other, full_name="Other Customer", email="other@example.com"
    )
    foreign_job = Job.objects.create(
        business=other,
        customer=other_customer,
        service_type="X",
        scheduled_at=timezone.now() + timedelta(days=1),
        duration_minutes=30,
    )
    foreign_inspection = Inspection.objects.create(
        job=foreign_job,
        phase="before",
        angle="front",
        photo=SimpleUploadedFile("foreign.jpg", _tiny_jpeg(), content_type="image/jpeg"),
    )

    response = api_client_auth.get(f"/api/inspections/{foreign_inspection.id}/")

    assert response.status_code == 404


def test_unauthenticated_inspection_access_is_denied(db):
    from rest_framework.test import APIClient

    response = APIClient().get("/api/inspections/")

    assert response.status_code in {401, 403}


@patch("inspections.serializers.detect_damage")
def test_inspection_upload_rejects_unsupported_content_type(
    mock_detect, api_client_auth, job
):
    photo = SimpleUploadedFile("front.gif", b"GIF89a", content_type="image/gif")

    response = api_client_auth.post(
        "/api/inspections/",
        {"job": job.id, "phase": "before", "angle": "front", "photo": photo},
        format="multipart",
    )

    assert response.status_code == 400
    mock_detect.assert_not_called()


@patch("inspections.serializers.detect_damage")
def test_inspection_upload_rejects_oversized_image(
    mock_detect, api_client_auth, job
):
    photo = SimpleUploadedFile(
        "front.jpg", _oversized_jpeg(), content_type="image/jpeg"
    )

    response = api_client_auth.post(
        "/api/inspections/",
        {"job": job.id, "phase": "before", "angle": "front", "photo": photo},
        format="multipart",
    )

    assert response.status_code == 400
    assert "smaller than 8 MB" in str(response.data)
    mock_detect.assert_not_called()


@patch("inspections.views.check_vehicle_frame")
def test_check_frame_proxies_ml_response(mock_check, api_client_auth):
    mock_check.return_value = {
        "ready": True,
        "reason": "ready",
        "guidance": "Hold steady",
        "vehicle": {"confidence": 0.91, "coverage": 0.54},
    }
    image = SimpleUploadedFile("frame.jpg", _tiny_jpeg(), content_type="image/jpeg")

    response = api_client_auth.post(
        "/api/inspections/check-frame/", {"image": image}, format="multipart"
    )

    assert response.status_code == 200
    assert response.data["ready"] is True
    assert response.data["vehicle"]["coverage"] == 0.54


@patch("inspections.views.check_vehicle_frame")
def test_check_frame_rejects_unsupported_content_type(mock_check, api_client_auth):
    image = SimpleUploadedFile("frame.gif", b"GIF89a", content_type="image/gif")

    response = api_client_auth.post(
        "/api/inspections/check-frame/", {"image": image}, format="multipart"
    )

    assert response.status_code == 400
    mock_check.assert_not_called()


@patch("inspections.views.check_vehicle_frame")
def test_check_frame_is_throttled(mock_check, api_client_auth, monkeypatch):
    from inspections.views import InspectionThrottle

    cache.clear()
    monkeypatch.setattr(InspectionThrottle, "rate", "1/hour")
    mock_check.return_value = {
        "ready": True,
        "reason": "ready",
        "guidance": "Hold steady",
    }

    first = api_client_auth.post(
        "/api/inspections/check-frame/",
        {
            "image": SimpleUploadedFile(
                "first.jpg", _tiny_jpeg(), content_type="image/jpeg"
            )
        },
        format="multipart",
    )
    second = api_client_auth.post(
        "/api/inspections/check-frame/",
        {
            "image": SimpleUploadedFile(
                "second.jpg", _tiny_jpeg(), content_type="image/jpeg"
            )
        },
        format="multipart",
    )

    assert first.status_code == 200
    assert second.status_code == 429
