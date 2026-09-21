# Generated for manual retention signal support

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("analytics", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerRetentionSignal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("retained", "Retained"), ("reassured", "Reassured"), ("watchlist", "Still at risk")], max_length=16)),
                ("note", models.TextField()),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="customer_retention_signals", to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="retention_signals", to="users.customer")),
                ("source_score", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="retention_signals", to="analytics.churnscore")),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["customer", "-created_at"], name="analytics_c_custome_343df6_idx"),
                    models.Index(fields=["expires_at"], name="analytics_c_expires_6d7f6a_idx"),
                ],
            },
        ),
    ]
