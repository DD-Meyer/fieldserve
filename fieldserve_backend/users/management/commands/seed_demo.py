"""
Seed a demo business + customers + jobs so the Expo app has data to display
after a fresh sign-in. Idempotent: re-running the same --clerk-id is safe.

Usage:
    python manage.py seed_demo --clerk-id <clerk_user_id> [--email me@x.com]
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from businesses.models import Business, Membership
from jobs.models import Job
from users.models import Customer, User


# Realistic London-ish coords (lng, lat)
SEED_CUSTOMERS = [
    ("Sarah Johnson",  "sarah@example.com",  "+44 7700 900001", "12 Riverside Ave, London",   -0.1276, 51.5074),
    ("Marcus Lee",     "marcus@example.com", "+44 7700 900002", "Apt 4B, 88 Pine St, London", -0.1410, 51.5155),
    ("Priya Patel",    "priya@example.com",  "+44 7700 900003", "31 Oak Lane, London",        -0.0980, 51.5202),
    ("Tom Becker",     "tom@example.com",    "+44 7700 900004", "204 Market Sq, London",      -0.0772, 51.5145),
    ("Elena Rossi",    "elena@example.com",  "+44 7700 900005", "55 Hill Rd, London",         -0.1500, 51.5340),
    ("David Kim",      "david@example.com",  "+44 7700 900006", "9 Brook St, London",         -0.1485, 51.5113),
]


def _job_specs(today_start):
    # 6 jobs today + 2 tomorrow, varied statuses
    return [
        (0, today_start.replace(hour=9,  minute=0),  60,  Decimal("80.00"),  "Full Detail · Sedan",     Job.Status.SCHEDULED),
        (1, today_start.replace(hour=10, minute=30), 45,  Decimal("45.00"),  "Exterior Wash",           Job.Status.SCHEDULED),
        (2, today_start.replace(hour=12, minute=15), 75,  Decimal("120.00"), "Interior Detail · SUV",   Job.Status.SCHEDULED),
        (3, today_start.replace(hour=14, minute=30), 50,  Decimal("65.00"),  "Headlight Restoration",   Job.Status.SCHEDULED),
        (4, today_start.replace(hour=16, minute=15), 240, Decimal("320.00"), "Ceramic Coating",         Job.Status.SCHEDULED),
        (5, today_start.replace(hour=8,  minute=0)  - timedelta(days=1), 30, Decimal("25.00"), "Express Wash", Job.Status.COMPLETED),
        (0, today_start.replace(hour=10, minute=0)  + timedelta(days=1), 60, Decimal("80.00"), "Full Detail · Sedan", Job.Status.SCHEDULED),
        (2, today_start.replace(hour=13, minute=0)  + timedelta(days=1), 75, Decimal("120.00"), "Interior Detail · SUV", Job.Status.PENDING),
    ]


class Command(BaseCommand):
    help = "Seed a demo business, customers and jobs for a Clerk user."

    def add_arguments(self, parser):
        parser.add_argument("--clerk-id", required=True, help="Clerk user id (sub)")
        parser.add_argument("--email", default="", help="Optional email to set on the user")
        parser.add_argument(
            "--business-name",
            default="FieldServe Detailing",
            help="Business display name",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        clerk_id = opts["clerk_id"].strip()
        email = opts["email"].strip()
        biz_name = opts["business_name"].strip()
        if not clerk_id:
            raise CommandError("--clerk-id is required")

        user, _ = User.objects.get_or_create(
            clerk_user_id=clerk_id,
            defaults={
                "username": clerk_id,
                "email": email or f"{clerk_id}@local.test",
                "first_name": "Demo",
                "last_name": "Owner",
            },
        )
        if email and user.email != email:
            user.email = email
            user.save(update_fields=["email"])

        slug = slugify(biz_name)
        biz, biz_created = Business.objects.get_or_create(
            owner=user,
            name=biz_name,
            defaults={
                "slug": slug,
                "industry_mode": Business.Industry.MOBILE,
                "email": "hello@fieldserve.local",
                "phone": "+44 20 1234 5678",
            },
        )
        Membership.objects.get_or_create(
            business=biz,
            user=user,
            defaults={
                "role": Membership.Role.OWNER,
                "status": Membership.Status.ACTIVE,
            },
        )

        customers: list[Customer] = []
        for name, c_email, phone, address, lng, lat in SEED_CUSTOMERS:
            cust, _ = Customer.objects.get_or_create(
                business=biz,
                full_name=name,
                defaults={
                    "email": c_email,
                    "phone": phone,
                    "address": address,
                    "location": Point(lng, lat, srid=4326),
                    "last_seen_at": timezone.now() - timedelta(days=10),
                },
            )
            customers.append(cust)

        today_start = timezone.localtime().replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        for cust_idx, when, dur, price, svc, status in _job_specs(today_start):
            cust = customers[cust_idx % len(customers)]
            Job.objects.get_or_create(
                business=biz,
                customer=cust,
                scheduled_at=when,
                service_type=svc,
                defaults={
                    "duration_minutes": dur,
                    "price": price,
                    "status": status,
                    "address": cust.address,
                    "location": cust.location,
                    "assigned_to": user,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed done. user={user.email} business='{biz.name}' "
                f"customers={biz.customers.count()} jobs={biz.jobs.count()}"
            )
        )
