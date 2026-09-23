"""Read-only: show every membership (role/status) for a user, across businesses.

Usage:
    python manage.py inspect_memberships --email jane@example.com
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from businesses.models import Membership
from users.models import User


class Command(BaseCommand):
    help = "List a user's memberships (business, role, status) by email."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User's email (case-insensitive)")

    def handle(self, *args, **opts):
        email = opts["email"].strip()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError(f"No user found with email={email!r}")

        memberships = Membership.objects.filter(user=user).select_related("business")
        if not memberships.exists():
            self.stdout.write(self.style.WARNING("No memberships found for this user."))
            return

        self.stdout.write(f"User: {user.email} (id={user.id}, clerk_user_id={user.clerk_user_id})\n")
        for m in memberships:
            owner_flag = " [OWNER]" if m.business.owner_id == user.id else ""
            self.stdout.write(
                f"- membership id={m.id} business=[{m.business.id}] {m.business.name!r} "
                f"(slug={m.business.slug}) role={m.role} status={m.status}{owner_flag}"
            )
