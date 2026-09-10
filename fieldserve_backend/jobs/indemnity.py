from rest_framework.exceptions import ValidationError

from businesses.models import IndemnityDocument

from .models import Job, JobIndemnity


def active_indemnity_for(business) -> IndemnityDocument:
    document = business.indemnities.filter(
        status=IndemnityDocument.Status.PUBLISHED
    ).order_by("-version").first()
    if document is None:
        raise ValidationError("This business must publish an indemnity before creating bookings.")
    return document


def attach_active_indemnity(job: Job) -> JobIndemnity:
    document = active_indemnity_for(job.business)
    return JobIndemnity.objects.create(
        job=job,
        document=document,
        version=document.version,
        source=document.source,
        document_checksum=document.checksum,
    )