from django.db import migrations, models


def normalize_membership_roles(apps, schema_editor):
    Membership = apps.get_model("businesses", "Membership")
    Membership.objects.filter(role="owner").update(role="admin")
    Membership.objects.filter(role="worker").update(role="staff")


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0006_business_clerk_organization_id"),
    ]

    operations = [
        migrations.RunPython(normalize_membership_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="membership",
            name="role",
            field=models.CharField(
                choices=[("admin", "Admin"), ("staff", "Staff")],
                default="staff",
                max_length=16,
            ),
        ),
    ]