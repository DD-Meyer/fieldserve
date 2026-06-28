"""Read-only API for the churn analytics dashboard.

Write operations (scoring, labelling, retraining) happen through management
commands so that the audit trail in `RetrainRun` is the authoritative history
of model lifecycle events.
"""

from __future__ import annotations

from django.db.models import OuterRef, Subquery
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import active_business_ids

from .models import ChurnLabel, ChurnScore, RetrainRun
from .serializers import (
    ChurnLabelSerializer,
    ChurnScoreSerializer,
    RetrainRunSerializer,
)


class ChurnScoreViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Latest-per-customer by default; full history available at /history/."""

    serializer_class = ChurnScoreSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["risk_bucket", "customer"]
    ordering_fields = ["scored_at", "probability"]

    def get_queryset(self):
        biz_ids = active_business_ids(self.request.user)
        base = ChurnScore.objects.select_related("customer").filter(
            customer__business_id__in=biz_ids
        )
        if self.action == "list":
            latest_pk = (
                ChurnScore.objects.filter(customer=OuterRef("customer"))
                .order_by("-scored_at")
                .values("pk")[:1]
            )
            return base.filter(pk=Subquery(latest_pk))
        return base

    @action(detail=False, methods=["get"], url_path=r"history/(?P<customer_pk>\d+)")
    def history(self, request, customer_pk: str):
        biz_ids = active_business_ids(request.user)
        qs = (
            ChurnScore.objects.select_related("customer")
            .filter(customer_id=customer_pk, customer__business_id__in=biz_ids)
            .order_by("-scored_at")
        )
        return Response(ChurnScoreSerializer(qs, many=True).data)


class ChurnLabelViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ChurnLabelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["customer", "churned"]
    ordering_fields = ["cutoff_date", "created_at"]

    def get_queryset(self):
        biz_ids = active_business_ids(self.request.user)
        return ChurnLabel.objects.select_related("customer").filter(
            customer__business_id__in=biz_ids
        )


class RetrainRunViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RetrainRunSerializer
    queryset = RetrainRun.objects.all()
    permission_classes = [permissions.IsAdminUser]
    ordering_fields = ["triggered_at"]
