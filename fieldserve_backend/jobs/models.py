from decimal import Decimal

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class Job(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="jobs"
    )
    customer = models.ForeignKey(
        "users.Customer", on_delete=models.CASCADE, related_name="jobs"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_jobs",
    )
    service_type = models.CharField(max_length=100)
    notes = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    location = gis_models.PointField(srid=4326, null=True, blank=True)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.IntegerField(null=True, blank=True)
    price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal("0.00")
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]
        indexes = [
            models.Index(fields=["business", "scheduled_at"]),
            models.Index(fields=["assigned_to", "scheduled_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.service_type} @ {self.scheduled_at:%Y-%m-%d %H:%M}"
