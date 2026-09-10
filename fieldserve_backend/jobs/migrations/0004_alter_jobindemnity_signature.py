from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0003_jobindemnity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="jobindemnity",
            name="signature",
            field=models.FileField(blank=True, upload_to="indemnity_signatures/%Y/%m/"),
        ),
    ]