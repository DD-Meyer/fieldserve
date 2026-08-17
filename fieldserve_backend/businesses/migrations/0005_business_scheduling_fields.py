import datetime

import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("businesses", "0004_alter_service_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="working_hours_start",
            field=models.TimeField(default=datetime.time(8, 0)),
        ),
        migrations.AddField(
            model_name="business",
            name="working_hours_end",
            field=models.TimeField(default=datetime.time(18, 0)),
        ),
        migrations.AddField(
            model_name="business",
            name="default_travel_buffer_minutes",
            field=models.PositiveIntegerField(default=15),
        ),
        migrations.AddField(
            model_name="business",
            name="depot_location",
            field=django.contrib.gis.db.models.fields.PointField(
                blank=True, null=True, srid=4326
            ),
        ),
    ]
