from django.db import migrations


def attach_missing_indemnities(apps, schema_editor):
    Business = apps.get_model("businesses", "Business")
    IndemnityDocument = apps.get_model("businesses", "IndemnityDocument")
    Job = apps.get_model("jobs", "Job")
    JobIndemnity = apps.get_model("jobs", "JobIndemnity")

    for business in Business.objects.all().iterator():
        document = (
            IndemnityDocument.objects.filter(
                business_id=business.id,
                status="published",
            )
            .order_by("-version")
            .first()
        )
        if document is None:
            continue

        for job in Job.objects.filter(business_id=business.id).exclude(indemnity__isnull=False).iterator():
            JobIndemnity.objects.create(
                job_id=job.id,
                document_id=document.id,
                version=document.version,
                source=document.source,
                document_checksum=document.checksum,
            )


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0011_business_deletion_requested_at"),
        ("jobs", "0004_alter_jobindemnity_signature"),
    ]

    operations = [
        migrations.RunPython(attach_missing_indemnities, reverse_noop),
    ]
