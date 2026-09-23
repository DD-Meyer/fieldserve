from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import Business


@shared_task
def purge_businesses_pending_deletion() -> int:
    cutoff = timezone.now() - timedelta(days=90)
    businesses = Business.objects.filter(
        deletion_requested_at__isnull=False,
        deletion_requested_at__lte=cutoff,
    )
    count = businesses.count()
    businesses.delete()
    return count