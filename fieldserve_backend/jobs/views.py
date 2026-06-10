from rest_framework import filters, viewsets

from .models import Job
from .serializers import JobSerializer


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.select_related("business", "customer", "assigned_to").all()
    serializer_class = JobSerializer
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ["service_type", "notes", "customer__full_name"]
    ordering_fields = ["scheduled_at", "created_at", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        assigned = self.request.query_params.get("assigned_to")
        if assigned == "me":
            qs = qs.filter(assigned_to=self.request.user)
        elif assigned:
            qs = qs.filter(assigned_to_id=assigned)
        return qs
