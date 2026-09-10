from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="inspection",
            name="photo",
            field=models.FileField(upload_to="inspections/%Y/%m/"),
        ),
    ]