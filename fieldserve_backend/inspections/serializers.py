from __future__ import annotations

import logging

from rest_framework import serializers

from .models import Inspection
from .ml_client import DamageServiceError, detect_damage

log = logging.getLogger(__name__)

MAX_INSPECTION_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_INSPECTION_IMAGE_TYPES = {"image/jpeg", "image/png"}


def validate_inspection_image(image):
    if image.size > MAX_INSPECTION_IMAGE_BYTES:
        raise serializers.ValidationError("Image must be smaller than 8 MB.")
    if image.content_type not in ALLOWED_INSPECTION_IMAGE_TYPES:
        raise serializers.ValidationError("Image must be a JPEG or PNG file.")
    return image


class InspectionSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    damage_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Inspection
        fields = [
            "id",
            "job",
            "phase",
            "angle",
            "photo",
            "photo_url",
            "analysis",
            "analysis_status",
            "analysis_error",
            "damage_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "analysis",
            "analysis_status",
            "analysis_error",
            "photo_url",
            "damage_count",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "photo": {"write_only": True},
        }

    def get_photo_url(self, obj: Inspection) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get("request")
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url

    def validate_photo(self, photo):
        return validate_inspection_image(photo)


def run_analysis(inspection: Inspection) -> None:
    """Call the ml_service synchronously and persist the result on the row.

    Kept idempotent so a retry endpoint could re-run this later. Any failure
    is captured on `analysis_error`; the inspection row is still preserved
    so the field worker doesn't lose the photo.
    """
    inspection.analysis_status = Inspection.AnalysisStatus.RUNNING
    inspection.save(update_fields=["analysis_status", "updated_at"])
    try:
        with inspection.photo.open("rb") as fh:
            image_bytes = fh.read()
        payload = detect_damage(image_bytes, filename=inspection.photo.name)
        inspection.analysis = payload
        inspection.analysis_status = Inspection.AnalysisStatus.DONE
        inspection.analysis_error = ""
    except DamageServiceError as exc:
        log.warning("Damage detection failed for inspection %s: %s", inspection.pk, exc)
        inspection.analysis_status = Inspection.AnalysisStatus.FAILED
        inspection.analysis_error = str(exc)
    except Exception as exc:  # noqa: BLE001 — surface anything else on the row
        log.exception("Unexpected error running damage detection")
        inspection.analysis_status = Inspection.AnalysisStatus.FAILED
        inspection.analysis_error = f"unexpected: {exc}"
    inspection.save(
        update_fields=[
            "analysis",
            "analysis_status",
            "analysis_error",
            "updated_at",
        ]
    )
