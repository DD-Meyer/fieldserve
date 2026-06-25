from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models as gis_models
from django.db import models


class User(AbstractUser):
    """Auth user; identity is owned by Clerk and mirrored via clerk_user_id."""

    clerk_user_id = models.CharField(
        max_length=64, unique=True, null=True, blank=True, db_index=True
    )
    phone = models.CharField(max_length=32, blank=True)
    avatar_url = models.URLField(blank=True)

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
