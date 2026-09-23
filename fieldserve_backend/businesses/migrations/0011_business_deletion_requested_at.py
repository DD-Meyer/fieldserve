from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0010_membership_buffer_minutes_membership_services"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="deletion_requested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]