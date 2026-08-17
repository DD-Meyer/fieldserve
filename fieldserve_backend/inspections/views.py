from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import parsers, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from jobs.models import Job
from users.permissions import IsBusinessMember, active_business_ids

from .models import Inspection
from .ml_client import DamageServiceError, check_vehicle_frame
from .serializers import InspectionSerializer, run_analysis, validate_inspection_image


class InspectionThrottle(UserRateThrottle):
    rate = "60/hour"


class InspectionViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filterset_fields = ["job", "phase", "angle", "analysis_status"]

    def get_throttles(self):
        if self.action in {"create", "reanalyse", "check_frame"}:
            return [InspectionThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        biz_ids = active_business_ids(self.request.user)
        qs = Inspection.objects.select_related("job", "job__business").filter(
            job__business_id__in=biz_ids
        )
        job_id = self.kwargs.get("job_pk") or self.request.query_params.get("job")
        if job_id:
            qs = qs.filter(job_id=job_id)
        return qs

    def perform_create(self, serializer):
        biz_ids = active_business_ids(self.request.user)
        job_id = self.kwargs.get("job_pk") or serializer.validated_data.get("job")
        job = get_object_or_404(Job, pk=job_id if not hasattr(job_id, "pk") else job_id.pk)
        if job.business_id not in biz_ids:
            raise PermissionDenied("Job is not in your business.")
        inspection = serializer.save(
            job=job,
            created_by=self.request.user,
        )
        run_analysis(inspection)

    @action(detail=True, methods=["post"], url_path="reanalyse")
    def reanalyse(self, request, pk=None):
        inspection = self.get_object()
        run_analysis(inspection)
        return Response(InspectionSerializer(inspection, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="check-frame")
    def check_frame(self, request):
        image = request.FILES.get("image")
        if image is None:
            raise ValidationError({"image": "An image is required."})
        try:
            validate_inspection_image(image)
        except ValidationError as exc:
            raise ValidationError({"image": exc.detail}) from exc
        try:
            result = check_vehicle_frame(image.read(), filename=image.name)
        except DamageServiceError as exc:
            raise ValidationError({"image": str(exc)}) from exc
        return Response(result)
