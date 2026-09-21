"""Read-only API for the churn analytics dashboard.

Write operations (scoring, labelling, retraining) happen through management
commands so that the audit trail in `RetrainRun` is the authoritative history
of model lifecycle events.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from users.models import Customer
from users.permissions import active_business_ids

from .models import ChurnLabel, ChurnScore, CustomerRetentionSignal, RetrainRun
from .scoring import adjusted_score_for_retention
from .serializers import (
    ChurnLabelSerializer,
    ChurnScoreSerializer,
    CustomerRetentionSignalSerializer,
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

    @action(detail=False, methods=["post"], url_path=r"retain/(?P<customer_pk>\d+)")
    def retain(self, request, customer_pk: str):
        biz_ids = active_business_ids(request.user)
        customer = Customer.objects.filter(
            pk=customer_pk, business_id__in=biz_ids
        ).first()
        if customer is None:
            raise NotFound("Customer not found.")

        status_value = request.data.get("status") or CustomerRetentionSignal.Status.REASSURED
        valid_statuses = {choice[0] for choice in CustomerRetentionSignal.Status.choices}
        if status_value not in valid_statuses:
            raise ValidationError({"status": "Unknown retention status."})
        note = str(request.data.get("note") or "").strip()
        if not note:
            raise ValidationError({"note": "A retention note is required."})
        try:
            expires_days = int(request.data.get("expires_days") or 90)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"expires_days": "Use a whole number of days."}) from exc
        if expires_days < 1:
            raise ValidationError({"expires_days": "Use at least 1 day."})

        with transaction.atomic():
            signal = CustomerRetentionSignal.objects.create(
                customer=customer,
                created_by=request.user,
                status=status_value,
                note=note,
                expires_at=timezone.now() + timedelta(days=expires_days),
            )
            stamped_note = (
                f"[{timezone.now():%Y-%m-%d %H:%M}] "
                f"Retention signal ({signal.get_status_display()}): {note}"
            )
            customer.notes = "\n".join(part for part in [customer.notes, stamped_note] if part)
            customer.save(update_fields=["notes", "updated_at"])
            adjusted = adjusted_score_for_retention(customer, signal)

        return Response(
            {
                "signal": CustomerRetentionSignalSerializer(signal).data,
                "score": ChurnScoreSerializer(adjusted).data if adjusted else None,
            }
        )


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
