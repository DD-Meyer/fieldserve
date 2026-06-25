from datetime import date as date_cls
from datetime import datetime

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from users.permissions import IsBusinessMember, active_business_ids

from .models import Job
from .serializers import JobSerializer


ALLOWED_TRANSITIONS = {
    Job.Status.PENDING: {Job.Status.SCHEDULED, Job.Status.CANCELLED},
    Job.Status.SCHEDULED: {Job.Status.IN_PROGRESS, Job.Status.CANCELLED},
    Job.Status.IN_PROGRESS: {Job.Status.COMPLETED, Job.Status.CANCELLED},
    Job.Status.COMPLETED: set(),
    Job.Status.CANCELLED: set(),
}


def _parse_date(value: str) -> date_cls | None:
    if not value:
        return None
    if value.lower() == "today":
        return timezone.localdate()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]
    search_fields = ["service_type", "notes", "customer__full_name"]
    ordering_fields = ["scheduled_at", "created_at", "status", "price"]
    filterset_fields = ["business", "status", "assigned_to"]

    def get_queryset(self):
        qs = (
            Job.objects.select_related("business", "customer", "assigned_to")
            .filter(business_id__in=active_business_ids(self.request.user))
        )
        params = self.request.query_params

        target_date = _parse_date(params.get("date", ""))
        if target_date is not None:
            qs = qs.filter(scheduled_at__date=target_date)

        if params.get("assigned_to") == "me":
            qs = qs.filter(assigned_to=self.request.user)

        return qs

    def perform_create(self, serializer):
        biz_ids = active_business_ids(self.request.user)
        cust = serializer.validated_data.get("customer")
        if cust is not None and cust.business_id not in biz_ids:
            raise PermissionDenied("Customer is not in your business.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        job = self.get_object()
        new_status = request.data.get("status")
        if new_status not in Job.Status.values:
            raise ValidationError({"status": "Unknown status."})
        allowed = ALLOWED_TRANSITIONS.get(job.status, set())
        if new_status not in allowed:
            raise ValidationError(
                {"status": f"Cannot transition from {job.status} to {new_status}."}
            )
        job.status = new_status
        if new_status == Job.Status.COMPLETED:
            job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(JobSerializer(job).data, status=status.HTTP_200_OK)
