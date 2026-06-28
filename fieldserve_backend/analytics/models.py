"""Analytics models — derived data from the ML service.

These tables are write-only from the management commands (`score_churn`,
`label_churn`, `retrain_churn`) and read-only from the CRM dashboard.
"""

from django.conf import settings
from django.db import models


class ChurnScore(models.Model):
    """Append-only history of churn probabilities returned by the ML service."""

    class RiskBucket(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="churn_scores"
    )
    scored_at = models.DateTimeField(
        help_text="The `as_of` timestamp sent to the ML service.",
    )
    probability = models.DecimalField(max_digits=5, decimal_places=4)
    risk_bucket = models.CharField(max_length=8, choices=RiskBucket.choices)

    model_version = models.CharField(
        max_length=64,
        help_text="Maps to the bundle's `trained_at` field — lets us trace which "
        "trained artefact produced this score.",
    )
    model_name = models.CharField(max_length=64)
    feature_set = models.CharField(max_length=64)
    feature_snapshot = models.JSONField(
        help_text="Exact feature dict sent to the ML service. Kept so that the "
        "matching ChurnLabel can be paired with the features used at score time.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scored_at"]
        indexes = [
            models.Index(fields=["customer", "-scored_at"]),
            models.Index(fields=["-scored_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer_id} {self.risk_bucket} {self.probability:.3f} @ {self.scored_at:%Y-%m-%d}"


class ChurnLabel(models.Model):
    """Ground-truth label computed after the churn window has fully elapsed.

    Created by the `label_churn` management command, one row per
    (customer, cutoff_date) pair.
    """

    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="churn_labels"
    )
    cutoff_date = models.DateField(
        help_text="The `as_of` date of the original ChurnScore this label corresponds to.",
    )
    window_days = models.IntegerField(default=180)
    churned = models.BooleanField(
        help_text="True if the customer had no completed job in [cutoff, cutoff+window_days].",
    )
    feature_snapshot = models.JSONField(
        help_text="Copy of the features at cutoff time. Used as the training X "
        "for retrain runs so that label and features are properly aligned.",
    )
    used_in_retrain = models.ForeignKey(
        "RetrainRun",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="labels_used",
        help_text="The retrain run that first consumed this label, if any.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cutoff_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "cutoff_date"], name="uniq_customer_cutoff"
            ),
        ]
        indexes = [
            models.Index(fields=["used_in_retrain"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer_id} churned={self.churned} cutoff={self.cutoff_date}"


class RetrainRun(models.Model):
    """Audit log: one row per retrain attempt against the ML service."""

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    triggered_by = models.CharField(
        max_length=120,
        help_text="User email or 'cron' for scheduled runs.",
    )
    triggered_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    n_samples = models.IntegerField(default=0)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.RUNNING
    )

    model_name = models.CharField(max_length=64, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    artefact_path = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-triggered_at"]

    def __str__(self) -> str:
        return f"RetrainRun#{self.pk} {self.status} ({self.triggered_at:%Y-%m-%d %H:%M})"
