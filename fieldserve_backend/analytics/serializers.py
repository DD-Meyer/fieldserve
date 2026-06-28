"""Serializers for the analytics dashboard."""

from rest_framework import serializers

from .models import ChurnLabel, ChurnScore, RetrainRun


class ChurnScoreSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = ChurnScore
        fields = [
            "id",
            "customer",
            "customer_name",
            "scored_at",
            "probability",
            "risk_bucket",
            "model_version",
            "model_name",
            "feature_set",
            "feature_snapshot",
            "created_at",
        ]
        read_only_fields = fields


class ChurnLabelSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = ChurnLabel
        fields = [
            "id",
            "customer",
            "customer_name",
            "cutoff_date",
            "window_days",
            "churned",
            "used_in_retrain",
            "created_at",
        ]
        read_only_fields = fields


class RetrainRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetrainRun
        fields = [
            "id",
            "triggered_by",
            "triggered_at",
            "finished_at",
            "n_samples",
            "status",
            "model_name",
            "metrics",
            "artefact_path",
            "error_message",
        ]
        read_only_fields = fields
