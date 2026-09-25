"""Auto-qualify all active members for any service that currently has none.

Fixes services created before qualification defaults existed - with zero
qualified members, `_qualified_members()` always returns [] and no time slot
can ever be offered, even on an empty day.

Usage:
    python manage.py backfill_service_qualifications          # dry run
    python manage.py backfill_service_qualifications --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from businesses.models import Membership, Service


class Command(BaseCommand):
    help = "Qualify all active members for any service with zero qualified members."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **opts):
        unqualified = Service.objects.filter(qualified_members__isnull=True).distinct()
        if not unqualified.exists():
            self.stdout.write(self.style.SUCCESS("Nothing to do - every service already has qualified members."))
            return

        for service in unqualified.select_related("business"):
            active_members = Membership.objects.filter(
                business=service.business, status=Membership.Status.ACTIVE
            )
            self.stdout.write(
                f"- [{service.id}] {service.name!r} (business={service.business.slug}) "
                f"-> qualifying {active_members.count()} active member(s)"
            )
            if opts["apply"]:
                service.qualified_members.set(active_members)

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("\nDry run only - re-run with --apply to save."))
        else:
            self.stdout.write(self.style.SUCCESS("Done."))
