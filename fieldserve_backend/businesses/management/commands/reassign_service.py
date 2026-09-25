"""Move a Service to a different business (fixes accidental cross-business creation).

Usage:
    # Dry run (default).
    python manage.py reassign_service --service-id 4 --to-slug global-detailers-247be4

    # Apply.
    python manage.py reassign_service --service-id 4 --to-slug global-detailers-247be4 --apply
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from businesses.models import Business, Service


class Command(BaseCommand):
    help = "Move a Service to a different business by slug."

    def add_arguments(self, parser):
        parser.add_argument("--service-id", type=int, required=True)
        parser.add_argument("--to-slug", required=True, help="Destination business slug")
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **opts):
        service = Service.objects.filter(pk=opts["service_id"]).select_related("business").first()
        if service is None:
            raise CommandError(f"No service found with id={opts['service_id']}")
        destination = Business.objects.filter(slug=opts["to_slug"]).first()
        if destination is None:
            raise CommandError(f"No business found with slug={opts['to_slug']!r}")

        self.stdout.write(
            f"service id={service.id} {service.name!r}: "
            f"business=[{service.business_id}] {service.business.slug!r} -> "
            f"[{destination.id}] {destination.slug!r}"
        )
        if service.business_id == destination.id:
            self.stdout.write(self.style.SUCCESS("Already on that business - nothing to do."))
            return
        if Service.objects.filter(business=destination, slug=service.slug).exclude(pk=service.pk).exists():
            raise CommandError("Destination business already has a service with that slug.")
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run only - re-run with --apply to save."))
            return

        service.business = destination
        service.save(update_fields=["business"])
        self.stdout.write(self.style.SUCCESS("Moved."))
