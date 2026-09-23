"""Shared soft-delete logic for a Business.

Used by both the authenticated "delete business account" endpoint
(BusinessViewSet.destroy) and the Clerk `organization.deleted` webhook, so an
org deleted directly in Clerk is reflected here the same way a manual delete
from the app is.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from jobs.models import Job

from .models import Business, Membership


class DeletionBlocked(Exception):
    """Raised when a business has jobs that must be resolved before deletion."""


def request_business_deletion(business: Business) -> None:
    if business.deletion_requested_at is not None:
        return

    blocking = business.jobs.filter(
        status__in=[Job.Status.SCHEDULED, Job.Status.IN_PROGRESS]
    ).count()
    if blocking:
        raise DeletionBlocked(
            "Cannot delete this business while it has in-progress or confirmed "
            f"bookings ({blocking}). Complete or cancel them first."
        )

    with transaction.atomic():
        business.jobs.filter(
            status=Job.Status.PENDING, scheduled_at__gte=timezone.now()
        ).update(status=Job.Status.CANCELLED, updated_at=timezone.now())
        business.deletion_requested_at = timezone.now()
        business.public_booking_enabled = False
        business.save(update_fields=["deletion_requested_at", "public_booking_enabled", "updated_at"])
        business.memberships.update(status=Membership.Status.INACTIVE)
