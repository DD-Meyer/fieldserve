from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "title",
                    models.CharField(max_length=255),
                ),
                (
                    "message",
                    models.TextField(blank=True),
                ),
                (
                    "read",
                    models.BooleanField(default=False),
                ),
                (
                    "archived",
                    models.BooleanField(default=False),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="users.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "read", "-created_at"],
                        name="users_notif_user_id_6c1c7e_idx",
                    ),
                    models.Index(
                        fields=["user", "archived", "-created_at"],
                        name="users_notif_user_id_9cf42e_idx",
                    ),
                ],
            },
        ),
    ]
