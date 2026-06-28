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
    ("Aisha Khan",     "aisha@example.com",  "+44 7700 900007", "22 Maple St, London",        -0.1350, 51.5230),
    ("James Wilson",   "james.wilson@example.com",   "+44 7700 900008", "18 Cedar Rd, London",          -0.1180, 51.5098),
    ("Emily Brown",    "emily.brown@example.com",    "+44 7700 900009", "76 Birch Ave, London",         -0.1331, 51.5171),
    ("Michael Davis",  "michael.davis@example.com",  "+44 7700 900010", "45 Willow St, London",         -0.1092, 51.5039),
    ("Sophia Green",   "sophia.green@example.com",   "+44 7700 900011", "91 Queen St, London",          -0.1223, 51.5124),
    ("Daniel White",   "daniel.white@example.com",   "+44 7700 900012", "15 Victoria Rd, London",       -0.1415, 51.5268),
    ("Olivia Taylor",  "olivia.taylor@example.com",  "+44 7700 900013", "62 King St, London",           -0.0951, 51.5187),
    ("Ethan Harris",   "ethan.harris@example.com",   "+44 7700 900014", "33 Church Rd, London",         -0.1464, 51.5061),
    ("Mia Clark",      "mia.clark@example.com",      "+44 7700 900015", "84 Elm Rd, London",            -0.1285, 51.5218),
    ("Noah Lewis",     "noah.lewis@example.com",     "+44 7700 900016", "7 Station Rd, London",         -0.1112, 51.5304),
    ("Grace Walker",   "grace.walker@example.com",   "+44 7700 900017", "28 Rose Ave, London",          -0.1378, 51.5148),
    ("Lucas Hall",     "lucas.hall@example.com",     "+44 7700 900018", "14 Regent St, London",         -0.1048, 51.5109),
    ("Chloe Young",    "chloe.young@example.com",    "+44 7700 900019", "102 Baker St, London",         -0.1570, 51.5237),
    ("Benjamin King",  "ben.king@example.com",       "+44 7700 900020", "56 Orchard Rd, London",        -0.1154, 51.5272),
    ("Amelia Scott",   "amelia.scott@example.com",   "+44 7700 900021", "39 George St, London",         -0.1205, 51.5054),
    ("Henry Adams",    "henry.adams@example.com",    "+44 7700 900022", "90 River Rd, London",          -0.0977, 51.5136),
    ("Lily Carter",    "lily.carter@example.com",    "+44 7700 900023", "17 High St, London",           -0.1389, 51.5220),
    ("Jack Mitchell",  "jack.mitchell@example.com",  "+44 7700 900024", "73 College Rd, London",        -0.1258, 51.5312),
    ("Ella Perez",     "ella.perez@example.com",     "+44 7700 900025", "11 Bridge Rd, London",         -0.1074, 51.5076),
    ("Logan Roberts",  "logan.roberts@example.com",  "+44 7700 900026", "29 Park Ave, London",          -0.1320, 51.5244),
    ("Zoe Turner",     "zoe.turner@example.com",     "+44 7700 900027", "51 Meadow Ln, London",         -0.1147, 51.5118),
    ("Matthew Phillips","matt.phillips@example.com", "+44 7700 900028", "68 Forest Rd, London",         -0.1433, 51.5196),
    ("Charlotte Evans","charlotte.evans@example.com","+44 7700 900029", "8 Crescent St, London",        -0.1026, 51.5152),
    ("Samuel Parker",  "sam.parker@example.com",     "+44 7700 900030", "121 North Rd, London",         -0.1365, 51.5295),
    ("Isabella Morris","isabella.morris@example.com","+44 7700 900031", "19 South St, London",          -0.1168, 51.5047),
    ("Alexander Reed", "alex.reed@example.com",      "+44 7700 900032", "64 Green Ln, London",          -0.1249, 51.5163),
    ("Harper Cooper",  "harper.cooper@example.com",  "+44 7700 900033", "37 Mill Rd, London",           -0.1008, 51.5259),
    ("Sebastian Bell", "seb.bell@example.com",       "+44 7700 900034", "26 West End, London",          -0.1496, 51.5094),
    ("Ava Murphy",     "ava.murphy@example.com",     "+44 7700 900035", "58 East Rd, London",           -0.1127, 51.5182),
    ("Leo Bailey",     "leo.bailey@example.com",     "+44 7700 900036", "40 Victoria Ave, London",      -0.1302, 51.5129),
    ("Hannah Brooks",  "hannah.brooks@example.com",  "+44 7700 900037", "93 Manor Rd, London",          -0.1065, 51.5278),
    ("Owen Foster",    "owen.foster@example.com",    "+44 7700 900038", "20 Garden St, London",         -0.1189, 51.5205),
    ("Victoria Ward",  "victoria.ward@example.com",  "+44 7700 900039", "13 Hilltop Ave, London",       -0.1457, 51.5068),
    ("Nathan Cox",     "nathan.cox@example.com",     "+44 7700 900040", "88 Manor Close, London",       -0.1034, 51.5231),
    ("Ruby Richardson","ruby.richardson@example.com","+44 7700 900041", "72 Chestnut Rd, London",      -0.1270, 51.5157),
    ("Isaac Howard",   "isaac.howard@example.com",   "+44 7700 900042", "24 Walnut St, London",         -0.1354, 51.5283),
    ("Lucy Bennett",   "lucy.bennett@example.com",   "+44 7700 900043", "10 Kingsway, London",          -0.1197, 51.5090),
    ("Gabriel Gray",   "gabriel.gray@example.com",   "+44 7700 900044", "59 Duke St, London",           -0.1105, 51.5140),
    ("Layla Hughes",   "layla.hughes@example.com",   "+44 7700 900045", "31 Albert Rd, London",         -0.1398, 51.5227),
    ("Julian Price",   "julian.price@example.com",   "+44 7700 900046", "81 Chapel Rd, London",         -0.1211, 51.5071),
    ("Sofia Collins",  "sofia.collins@example.com",  "+44 7700 900047", "47 Windsor Rd, London",        -0.1017, 51.5301),
    ("Ryan James",     "ryan.james@example.com",     "+44 7700 900048", "6 Ivy Lane, London",           -0.1473, 51.5116),
    ("Natalie Cook",   "natalie.cook@example.com",   "+44 7700 900049", "53 Poplar Rd, London",         -0.1264, 51.5190),
    ("Andrew Morgan",  "andrew.morgan@example.com",  "+44 7700 900050", "95 Beech Rd, London",          -0.1088, 51.5250),
    ("Aria Bailey",    "aria.bailey@example.com",    "+44 7700 900051", "35 Sycamore Ave, London",      -0.1160, 51.5059),
    ("Connor Ross",    "connor.ross@example.com",    "+44 7700 900052", "74 Grove Rd, London",          -0.1327, 51.5169),
    ("Eva Sanders",    "eva.sanders@example.com",    "+44 7700 900053", "16 Richmond Rd, London",       -0.1421, 51.5235),
    ("Aaron Powell",   "aaron.powell@example.com",   "+44 7700 900054", "66 Camden Rd, London",         -0.1059, 51.5084),
    ("Scarlett Long",  "scarlett.long@example.com",  "+44 7700 900055", "27 Lancaster St, London",      -0.1175, 51.5210),
    ("Dylan Hughes",   "dylan.hughes@example.com",   "+44 7700 900056", "43 Kensington Rd, London",     -0.1518, 51.5141),
    ("Bella Foster",   "bella.foster@example.com",   "+44 7700 900057", "12 Grove Lane, London",        -0.1296, 51.5261),
    ("Adam Simmons",   "adam.simmons@example.com",   "+44 7700 900058", "85 Oxford Rd, London",         -0.1138, 51.5097),
    ("Madison Kelly",  "madison.kelly@example.com",  "+44 7700 900059", "38 Cornwall Rd, London",       -0.1404, 51.5185),
    ("Joseph Stewart", "joseph.stewart@example.com", "+44 7700 900060", "97 Somerset Rd, London",       -0.1228, 51.5318),
    ("Anna Jenkins",   "anna.jenkins@example.com",   "+44 7700 900061", "61 Norfolk St, London",        -0.0999, 51.5133),
    ("Christopher Barnes","chris.barnes@example.com","+44 7700 900062","44 Prince St, London",         -0.1442, 51.5206),
    ("Claire Fisher",  "claire.fisher@example.com",  "+44 7700 900063", "79 Queen Anne Rd, London",     -0.1072, 51.5045),
    ("Thomas Graham",  "thomas.graham@example.com",  "+44 7700 900064", "18 Waterloo Rd, London",       -0.1340, 51.5247),
    ("Megan Holmes",   "megan.holmes@example.com",   "+44 7700 900065", "50 Tower St, London",          -0.0968, 51.5114),
    ("Jordan Ellis",   "jordan.ellis@example.com",   "+44 7700 900066", "71 Abbey Rd, London",          -0.1532, 51.5270),
    ("Brooke West",    "brooke.west@example.com",    "+44 7700 900067", "9 Fairfield Rd, London",       -0.1251, 51.5161),
    ("Tyler Stone",    "tyler.stone@example.com",    "+44 7700 900068", "104 Queens Rd, London",        -0.1159, 51.5104),
    ("Paige Ford",     "paige.ford@example.com",     "+44 7700 900069", "57 Avenue Rd, London",         -0.1391, 51.5239),
    ("Brandon Wells",  "brandon.wells@example.com",  "+44 7700 900070", "32 York St, London",           -0.1044, 51.5078),
    ("Julia Hart",     "julia.hart@example.com",     "+44 7700 900071", "83 Dorset Rd, London",         -0.1219, 51.5189),
    ("Kevin Knight",   "kevin.knight@example.com",   "+44 7700 900072", "14 Oxford Gardens, London",    -0.1317, 51.5298),
    ("Rachel Dean",    "rachel.dean@example.com",    "+44 7700 900073", "65 Holland Rd, London",        -0.1116, 51.5051),
    ("Justin Fox",     "justin.fox@example.com",     "+44 7700 900074", "22 Primrose Hill, London",     -0.1490, 51.5216),
    ("Lauren Woods",   "lauren.woods@example.com",   "+44 7700 900075", "49 Pelham Rd, London",         -0.1022, 51.5143),
    ("Eric Marshall",  "eric.marshall@example.com",  "+44 7700 900076", "87 Temple Rd, London",         -0.1362, 51.5265),
    ("Jasmine Cole",   "jasmine.cole@example.com",   "+44 7700 900077", "30 Marble Arch, London",       -0.1561, 51.5120),
    ("Patrick Russell","patrick.russell@example.com","+44 7700 900078", "75 Gloucester Rd, London",    -0.1096, 51.5194),
    ("Nicole Perry",   "nicole.perry@example.com",   "+44 7700 900079", "5 Lavender Rd, London",        -0.1183, 51.5088),
    ("Jason Bryant",   "jason.bryant@example.com",   "+44 7700 900080", "109 Hyde Park Rd, London",     -0.1453, 51.5242),
    ("Stephanie Reed", "stephanie.reed@example.com", "+44 7700 900081", "54 Lime St, London",           -0.1003, 51.5174),
    ("Scott Freeman",  "scott.freeman@example.com",  "+44 7700 900082", "26 Brompton Rd, London",       -0.1508, 51.5065),
    ("Rebecca Murray", "rebecca.murray@example.com", "+44 7700 900083", "91 Holland Park, London",      -0.1267, 51.5222),
    ("Nathaniel Shaw", "nathan.shaw@example.com",    "+44 7700 900084", "46 Union St, London",          -0.1121, 51.5292),
    ("Alice Bishop",   "alice.bishop@example.com",   "+44 7700 900085", "63 Kings Rd, London",          -0.1372, 51.5092),
    ("Dominic Arnold", "dominic.arnold@example.com", "+44 7700 900086", "17 Queensway, London",         -0.1237, 51.5149),
    ("Kayla Spencer",  "kayla.spencer@example.com",  "+44 7700 900087", "80 Lincoln Rd, London",        -0.1068, 51.5276),
    ("Tristan Harvey", "tristan.harvey@example.com", "+44 7700 900088", "11 Grosvenor Rd, London",      -0.1428, 51.5107),
    ("Faith Carpenter","faith.carpenter@example.com","+44 7700 900089", "69 Whitehall Rd, London",      -0.1201, 51.5198),
    ("Colin Gibson",   "colin.gibson@example.com",   "+44 7700 900090", "34 Hanover St, London",        -0.0989, 51.5049),
    ("Leah Burton",    "leah.burton@example.com",    "+44 7700 900091", "56 Earl St, London",           -0.1358, 51.5253),
    ("Victor Armstrong","victor.armstrong@example.com","+44 7700 900092","92 Wellington Rd, London",   -0.1164, 51.5110),
    ("Nina Chapman",   "nina.chapman@example.com",   "+44 7700 900093", "25 Finsbury Rd, London",       -0.1278, 51.5208),
    ("Caleb Dixon",    "caleb.dixon@example.com",    "+44 7700 900094", "70 Spencer Rd, London",        -0.1081, 51.5288),
    ("Stella Holmes",  "stella.holmes@example.com",  "+44 7700 900095", "15 Russell Sq, London",        -0.1409, 51.5079),
    ("Elliot Barker",  "elliot.barker@example.com",  "+44 7700 900096", "89 Clifford Rd, London",       -0.1192, 51.5159),
    ("Naomi Walters",  "naomi.walters@example.com",  "+44 7700 900097", "42 Paddington Rd, London",     -0.1511, 51.5233),
    ("George Lawson",  "george.lawson@example.com",  "+44 7700 900098", "60 Brent St, London",          -0.1037, 51.5102),
    ("Audrey Howell",  "audrey.howell@example.com",  "+44 7700 900099", "23 Mayfair Rd, London",        -0.1384, 51.5178),
    ("Finn Matthews",  "finn.matthews@example.com",  "+44 7700 900100", "78 Carlton Rd, London",        -0.1142, 51.5269)

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

        # We iterate over customers and use the index to pick a job from the list.
        for idx, cust in enumerate(customers):
            specs = _job_specs(today_start)
            spec_idx = idx % len(specs)
            _, when, dur, price, svc, status = specs[spec_idx]

            job_time = when - timedelta(days=(idx % 90))  # spread jobs over the last 90 days

            Job.objects.get_or_create(
                business=biz,
                customer=cust,
                scheduled_at=job_time,
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
                f"customers={len(customers)} jobs={Job.objects.filter(business=biz).count()}"
            )
        )
