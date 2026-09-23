from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_notification"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="notification",
            old_name="users_notif_user_id_6c1c7e_idx",
            new_name="users_notif_user_id_4fa49a_idx",
        ),
        migrations.RenameIndex(
            model_name="notification",
            old_name="users_notif_user_id_9cf42e_idx",
            new_name="users_notif_user_id_baa580_idx",
        ),
    ]
