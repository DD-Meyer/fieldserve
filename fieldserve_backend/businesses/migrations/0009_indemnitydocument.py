from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0008_membership_pending_invitation_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="IndemnityDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.PositiveIntegerField()),
                ("source", models.CharField(choices=[("text", "Text"), ("pdf", "PDF")], max_length=8)),
                ("text", models.TextField(blank=True)),
                ("document", models.FileField(blank=True, upload_to="indemnities/%Y/%m/")),
                ("checksum", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("published", "Published"), ("archived", "Archived")], default="draft", max_length=12)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="indemnities", to="businesses.business")),
                ("created_by", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="created_indemnities", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-version"]},
        ),
        migrations.AddConstraint(
            model_name="indemnitydocument",
            constraint=models.UniqueConstraint(fields=("business", "version"), name="unique_indemnity_version"),
        ),
    ]