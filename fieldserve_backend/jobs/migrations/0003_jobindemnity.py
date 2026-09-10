from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0009_indemnitydocument"),
        ("jobs", "0002_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="JobIndemnity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.PositiveIntegerField()),
                ("source", models.CharField(max_length=8)),
                ("document_checksum", models.CharField(blank=True, max_length=64)),
                ("signed_name", models.CharField(blank=True, max_length=120)),
                ("signature", models.ImageField(blank=True, upload_to="indemnity_signatures/%Y/%m/")),
                ("signed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("document", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="job_acknowledgements", to="businesses.indemnitydocument")),
                ("job", models.OneToOneField(on_delete=models.deletion.CASCADE, related_name="indemnity", to="jobs.job")),
            ],
        ),
    ]