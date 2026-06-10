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
    location = gis_models.PointField()
    scheduled_at = models.DateTimeField()
    duration_minutes = models.IntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]

    def __str__(self) -> str:
        return f"{self.service_type} @ {self.scheduled_at:%Y-%m-%d %H:%M}"
