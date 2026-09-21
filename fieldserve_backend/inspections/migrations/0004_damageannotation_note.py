# Generated for damage review notes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0003_damageannotation"),
    ]

    operations = [
        migrations.AddField(
            model_name="damageannotation",
            name="note",
            field=models.TextField(blank=True),
        ),
    ]
