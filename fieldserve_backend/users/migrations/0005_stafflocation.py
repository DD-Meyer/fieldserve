from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_user_preferences"),
        ("businesses", "0011_business_deletion_requested_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("latitude", models.FloatField()),
                ("longitude", models.FloatField()),
                ("tracking_enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_locations", to="businesses.business")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_locations", to="users.user")),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("business", "user"), name="unique_staff_location_business_user")]},
        ),
    ]