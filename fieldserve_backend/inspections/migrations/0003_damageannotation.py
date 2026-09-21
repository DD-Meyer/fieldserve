from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inspections", "0002_alter_inspection_photo"),
    ]

    operations = [
        migrations.CreateModel(
            name="DamageAnnotation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("boxes", models.JSONField(default=list)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("split", models.CharField(choices=[("train", "Train"), ("val", "Validation"), ("test", "Test")], default="train", max_length=8)),
                ("approved", models.BooleanField(default=False)),
                ("exported_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("inspection", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="damage_annotation", to="inspections.inspection")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_damage_annotations", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-reviewed_at", "-created_at"],
                "indexes": [
                    models.Index(fields=["approved", "split"], name="inspection_approve_5b87d8_idx"),
                    models.Index(fields=["exported_at"], name="inspection_exporte_a1211d_idx"),
                ],
            },
        ),
    ]