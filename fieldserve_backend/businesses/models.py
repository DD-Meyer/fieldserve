from datetime import time

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class Business(models.Model):
    class Industry(models.TextChoices):
        MOBILE = "mobile", "Mobile service"
        FIXED = "fixed", "Fixed location"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="businesses_owned",
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="Membership",
        related_name="businesses",
    )

    name = models.CharField(max_length=120)
    clerk_organization_id = models.CharField(
        max_length=64, unique=True, null=True, blank=True, db_index=True
    )
    trading_name = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True)
    industry_mode = models.CharField(
        max_length=16, choices=Industry.choices, default=Industry.MOBILE
    )

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    website = models.CharField(max_length=200, blank=True)
    tax_id = models.CharField(max_length=64, blank=True)

    address_line1 = models.CharField(max_length=255, blank=True)
    address_city = models.CharField(max_length=120, blank=True)
    address_postcode = models.CharField(max_length=20, blank=True)
    address_country = models.CharField(max_length=64, blank=True)

    brand_color = models.CharField(max_length=9, default="#2563EB")
    logo_url = models.URLField(blank=True)

    public_booking_enabled = models.BooleanField(default=True)

    # Scheduling settings
    working_hours_start = models.TimeField(default=time(8, 0))
    working_hours_end = models.TimeField(default=time(18, 0))
    default_travel_buffer_minutes = models.PositiveIntegerField(default=15)
    depot_location = gis_models.PointField(srid=4326, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        WORKER = "worker", "Worker"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INVITED = "invited", "Invited"
        INACTIVE = "inactive", "Inactive"

    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.WORKER)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "user")
        ordering = ["business_id", "role"]

    def __str__(self) -> str:
        return f"{self.user} @ {self.business} ({self.role})"


class Service(models.Model):
    """A bookable service that customers can pick on the public booking page."""

    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name="services"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("business", "slug")
        ordering = ["business_id", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.business})"
