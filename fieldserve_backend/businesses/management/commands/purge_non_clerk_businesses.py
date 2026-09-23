"""Remove businesses that aren't backed by a real Clerk organization.

Production should only ever have Business rows created through the Clerk
webhook / org-linked signup flow (`clerk_organization_id` set). Rows with a
null/blank `clerk_organization_id` are leftovers from `seed_demo` runs (or
manual admin creation) without `--clerk-organization-id`, and shouldn't be
reachable from the public booking pages.

Usage:
    # Dry run (default) — lists what would be deleted, changes nothing.
    python manage.py purge_non_clerk_businesses

    # Delete one specific business by slug.
    python manage.py purge_non_clerk_businesses --slug fieldserve-detailing-fixed-location --apply

    # Delete every business without a linked Clerk organization.
    python manage.py purge_non_clerk_businesses --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from businesses.models import Business


class Command(BaseCommand):
    help = "Delete Business rows with no linked Clerk organization (or a specific slug)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            default="",
            help="Only target this business slug (still requires --apply to delete).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually delete. Without this flag, only a dry-run listing is printed.",
        )

    def handle(self, *args, **opts):
        slug = opts["slug"].strip()

        if slug:
            queryset = Business.objects.filter(slug=slug)
            if not queryset.exists():
                raise CommandError(f"No business found with slug={slug!r}")
        else:
            queryset = Business.objects.filter(
                Q(clerk_organization_id__isnull=True) | Q(clerk_organization_id="")
            )

        if not queryset.exists():
            self.stdout.write(self.style.SUCCESS("Nothing to do — no matching businesses."))
            return

        for biz in queryset:
            self.stdout.write(
                f"- [{biz.id}] {biz.name!r} (slug={biz.slug}, "
                f"clerk_organization_id={biz.clerk_organization_id or 'NONE'}, "
                f"jobs={biz.jobs.count()}, customers={biz.customers.count()}, "
                f"services={biz.services.count()})"
            )

        if not opts["apply"]:
            self.stdout.write(
                self.style.WARNING(
                    f"\nDry run only — {queryset.count()} business(es) listed above would be "
                    "deleted (with all their jobs/customers/services/indemnities cascaded). "
                    "Re-run with --apply to actually delete."
                )
            )
            return

        with transaction.atomic():
            count = queryset.count()
            for biz in list(queryset):
                biz.delete()

        self.stdout.write(self.style.SUCCESS(f"Deleted {count} business(es)."))
