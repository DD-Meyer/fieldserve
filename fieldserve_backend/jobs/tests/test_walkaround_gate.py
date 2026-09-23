from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from inspections.models import Inspection, REQUIRED_WALKAROUND_ANGLES
from businesses.models import IndemnityDocument
from jobs.models import Job
from jobs.indemnity import attach_active_indemnity

pytestmark = pytest.mark.django_db


@pytest.fixture
def scheduled_job(business, customer, user):
    IndemnityDocument.objects.create(
        business=business,
        created_by=user,
        version=1,
        source=IndemnityDocument.Source.TEXT,
        text="Test indemnity",
        status=IndemnityDocument.Status.PUBLISHED,
    )
    job = Job.objects.create(
        business=business,
        customer=customer,
        assigned_to=user,
        service_type="Vehicle detail",
        scheduled_at=timezone.now() + timedelta(hours=1),
        duration_minutes=60,
        status=Job.Status.SCHEDULED,
    )
    attach_active_indemnity(job)
    return job


def _inspection(job, user, angle, phase=Inspection.Phase.BEFORE):
    return Inspection.objects.create(
        job=job,
        created_by=user,
        phase=phase,
        angle=angle,
        photo=SimpleUploadedFile(f"{angle}.jpg", b"photo", content_type="image/jpeg"),
    )


def test_start_job_requires_complete_walkaround(api_client_auth, scheduled_job):
    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/transition/", {"status": "in_progress"}
    )

    assert response.status_code == 400
    assert response.data["missing_angles"] == list(REQUIRED_WALKAROUND_ANGLES)
    scheduled_job.refresh_from_db()
    assert scheduled_job.status == Job.Status.SCHEDULED


def test_start_job_after_all_required_images(api_client_auth, scheduled_job, user):
    for angle in REQUIRED_WALKAROUND_ANGLES:
        _inspection(scheduled_job, user, angle)

    scheduled_job.indemnity.signed_name = "Client Name"
    scheduled_job.indemnity.signed_at = timezone.now()
    scheduled_job.indemnity.signature = SimpleUploadedFile(
        "signature.jpg", b"signature", content_type="image/jpeg"
    )
    scheduled_job.indemnity.save(update_fields=["signed_name", "signed_at", "signature"])

    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/transition/", {"status": "in_progress"}
    )

    assert response.status_code == 200
    assert response.data["status"] == Job.Status.IN_PROGRESS
    assert response.data["walkaround_complete"] is True
    assert response.data["walkaround_missing_angles"] == []


def test_sign_indemnity_requires_complete_walkaround(api_client_auth, scheduled_job):
    signature = SimpleUploadedFile("signature.jpg", b"signature", content_type="image/jpeg")
    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/indemnity/sign/",
        {"signed_name": "Client Name", "signature": signature},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.data["detail"] == "Complete the vehicle walkaround before collecting the signature."


def test_sign_indemnity_succeeds_after_walkaround(api_client_auth, scheduled_job, user):
    for angle in REQUIRED_WALKAROUND_ANGLES:
        _inspection(scheduled_job, user, angle)

    signature = SimpleUploadedFile("signature.jpg", b"signature", content_type="image/jpeg")
    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/indemnity/sign/",
        {"signed_name": "Client Name", "signature": signature},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["indemnity_signed"] is True
    assert response.data["walkaround_complete"] is True


def test_complete_job_requires_after_walkaround(api_client_auth, scheduled_job, user):
    scheduled_job.status = Job.Status.IN_PROGRESS
    scheduled_job.save(update_fields=["status"])

    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/transition/", {"status": "completed"}
    )

    assert response.status_code == 400
    assert response.data["missing_angles"] == list(REQUIRED_WALKAROUND_ANGLES)
    scheduled_job.refresh_from_db()
    assert scheduled_job.status == Job.Status.IN_PROGRESS


def test_complete_job_after_all_after_images(api_client_auth, scheduled_job, user):
    scheduled_job.status = Job.Status.IN_PROGRESS
    scheduled_job.save(update_fields=["status"])
    for angle in REQUIRED_WALKAROUND_ANGLES:
        _inspection(scheduled_job, user, angle, phase=Inspection.Phase.AFTER)

    response = api_client_auth.post(
        f"/api/jobs/{scheduled_job.id}/transition/", {"status": "completed"}
    )

    assert response.status_code == 200
    assert response.data["status"] == Job.Status.COMPLETED
    assert response.data["after_walkaround_complete"] is True
    assert response.data["after_walkaround_missing_angles"] == []