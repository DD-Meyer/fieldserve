from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models as gis_models
from django.conf import settings
from django.db import models


class User(AbstractUser):
    """Auth user; identity is owned by Clerk and mirrored via clerk_user_id."""

    class TextSize(models.TextChoices):
        DEFAULT = "default", "Default"
        LARGE = "large", "Large"

    clerk_user_id = models.CharField(
        max_length=64, unique=True, null=True, blank=True, db_index=True
    )
    phone = models.CharField(max_length=32, blank=True)
    avatar_url = models.URLField(blank=True)
    push_notifications_enabled = models.BooleanField(default=True)
    email_notifications_enabled = models.BooleanField(default=True)
    dark_mode_enabled = models.BooleanField(default=False)
    background_location_enabled = models.BooleanField(default=False)
    text_size = models.CharField(
        max_length=16, choices=TextSize.choices, default=TextSize.DEFAULT
    )
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.email or self.username or f"user#{self.pk}"


class Customer(models.Model):
    """End customer of a business (not an auth user)."""

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="customers"
    )
    full_name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    location = gis_models.PointField(srid=4326, null=True, blank=True)
    notes = models.TextField(blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name


class StaffLocation(models.Model):
    """The latest opted-in location for one user within one business."""

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="staff_locations"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_locations"
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    tracking_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["business", "user"], name="unique_staff_location_business_user"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.business}"


class Notification(models.Model):
    """Notification for a user."""

    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "read", "-created_at"]),
            models.Index(fields=["user", "archived", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Notification for {self.user.email or self.user.username}: {self.title}"