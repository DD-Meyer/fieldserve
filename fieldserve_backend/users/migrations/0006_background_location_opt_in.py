from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0005_stafflocation")]

    operations = [
        migrations.RunPython(
            lambda apps, schema_editor: apps.get_model("users", "User").objects.update(
                background_location_enabled=False
            ),
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="user",
            name="background_location_enabled",
            field=models.BooleanField(default=False),
        ),
    ]