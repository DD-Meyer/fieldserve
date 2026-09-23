"""Fix a user's membership role for a business (e.g. staff -> admin).

Usage:
    # Dry run (default) — shows current vs proposed role, changes nothing.
    python manage.py set_membership_role --email jane@example.com --slug my-business --role admin

    # Apply the change.
    python manage.py set_membership_role --email jane@example.com --slug my-business --role admin --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from businesses.models import Business, Membership
from users.models import User


class Command(BaseCommand):
    help = "Set a user's membership role (admin/staff) for a specific business."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User's email (case-insensitive)")
        parser.add_argument("--slug", required=True, help="Business slug")
        parser.add_argument("--role", required=True, choices=Membership.Role.values)
        parser.add_argument("--apply", action="store_true", help="Actually save the change.")

    def handle(self, *args, **opts):
        email = opts["email"].strip()
        slug = opts["slug"].strip()
        role = opts["role"]

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError(f"No user found with email={email!r}")
        business = Business.objects.filter(slug=slug).first()
        if business is None:
            raise CommandError(f"No business found with slug={slug!r}")
        membership = Membership.objects.filter(user=user, business=business).first()
        if membership is None:
            raise CommandError("This user has no membership on that business.")

        self.stdout.write(
            f"membership id={membership.id}: role={membership.role!r} -> {role!r} "
            f"(status={membership.status})"
        )
        if membership.role == role:
            self.stdout.write(self.style.SUCCESS("Already set — nothing to do."))
            return
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run only — re-run with --apply to save."))
            return

        membership.role = role
        membership.save(update_fields=["role"])
        self.stdout.write(self.style.SUCCESS("Updated."))
