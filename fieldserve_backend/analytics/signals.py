"""Signals that keep `Customer.last_seen_at` and `ChurnScore` rows fresh.

The post_save handler on `Job` does two things after the booking transaction
commits:
1. Bumps the customer's `last_seen_at` so the CRM list shows recency without
   needing to recompute from job history.
2. Rescore the customer via the ML service so the dashboard reflects the new
   booking immediately.

Both steps are best-effort — if the ML service is down, the booking still
saves. The signal runs on `transaction.on_commit` so an outer rollback
correctly suppresses the rescore.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from jobs.models import Job
from users.models import Customer

from .scoring import safe_score_customer

log = logging.getLogger(__name__)


@receiver(post_save, sender=Job)
def _rescore_on_job_save(sender, instance: Job, created, **kwargs) -> None:
    customer_id = instance.customer_id
    if not customer_id:
        return

    # Update last_seen_at if the new job extends recency.
    now = timezone.now()
    job_dt = instance.scheduled_at
    if job_dt and job_dt <= now:
        Customer.objects.filter(pk=customer_id, last_seen_at__lt=job_dt).update(
            last_seen_at=job_dt
        )
        Customer.objects.filter(pk=customer_id, last_seen_at__isnull=True).update(
            last_seen_at=job_dt
        )

    def _rescore() -> None:
        try:
            customer = Customer.objects.get(pk=customer_id)
        except Customer.DoesNotExist:
            return
        safe_score_customer(customer)

    transaction.on_commit(_rescore)


@receiver(post_delete, sender=Job)
def _rescore_on_job_delete(sender, instance: Job, **kwargs) -> None:
    customer_id = instance.customer_id
    if not customer_id:
        return

    def _rescore() -> None:
        try:
            customer = Customer.objects.get(pk=customer_id)
        except Customer.DoesNotExist:
            return
        safe_score_customer(customer)

    transaction.on_commit(_rescore)
