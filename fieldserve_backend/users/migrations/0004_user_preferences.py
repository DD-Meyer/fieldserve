from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_rename_notification_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="background_location_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="dark_mode_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="email_notifications_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="push_notifications_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="quiet_hours_end",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="quiet_hours_start",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="text_size",
            field=models.CharField(
                choices=[("default", "Default"), ("large", "Large")],
                default="default",
                max_length=16,
            ),
        ),
    ]