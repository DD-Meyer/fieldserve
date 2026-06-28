from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("businesses", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="public_booking_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name="Service",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140)),
                ("description", models.TextField(blank=True)),
                ("duration_minutes", models.PositiveIntegerField(default=60)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "business",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="services",
                        to="businesses.business",
                    ),
                ),
            ],
            options={
                "ordering": ["business_id", "name"],
                "unique_together": {("business", "slug")},
            },
        ),
    ]
