"""Soft-delete businesses whose linked Clerk organization no longer exists.

Covers orgs deleted directly in Clerk before the `organization.deleted`
webhook handler existed (or if a webhook delivery was ever missed) - checks
each Clerk-linked business against the Clerk API and applies the same
soft-delete used by `organization.deleted` / the in-app "delete business".

Usage:
    # Dry run (default) - lists which businesses would be affected.
    python manage.py sync_deleted_organizations

    # Apply.
    python manage.py sync_deleted_organizations --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from businesses.clerk import ClerkAPIError, get_organization
from businesses.deletion import DeletionBlocked, request_business_deletion
from businesses.models import Business


class Command(BaseCommand):
    help = "Soft-delete businesses whose linked Clerk organization was deleted."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually apply the deletions.")

    def handle(self, *args, **opts):
        candidates = Business.objects.filter(
            clerk_organization_id__isnull=False, deletion_requested_at__isnull=True
        ).exclude(clerk_organization_id="")

        missing = []
        for biz in candidates:
            try:
                get_organization(biz.clerk_organization_id)
            except ClerkAPIError as exc:
                if exc.code == "resource_not_found":
                    missing.append(biz)
                else:
                    self.stdout.write(
                        self.style.WARNING(f"[{biz.slug}] Clerk lookup failed ({exc.code}): {exc}")
                    )

        if not missing:
            self.stdout.write(self.style.SUCCESS("Nothing to do - every Clerk-linked business still exists."))
            return

        for biz in missing:
            self.stdout.write(f"- [{biz.id}] {biz.name!r} (slug={biz.slug}) - Clerk org no longer exists")

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("\nDry run only - re-run with --apply to soft-delete these."))
            return

        for biz in missing:
            try:
                request_business_deletion(biz)
                self.stdout.write(self.style.SUCCESS(f"Soft-deleted [{biz.id}] {biz.slug}"))
            except DeletionBlocked as exc:
                self.stdout.write(self.style.ERROR(f"[{biz.slug}] blocked: {exc}"))
