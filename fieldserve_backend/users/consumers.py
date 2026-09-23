from __future__ import annotations

from datetime import timedelta
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.http import HttpRequest
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from .auth import ClerkJWTAuthentication
from .models import StaffLocation
from businesses.models import Business, Membership
from jobs.models import Job


class AuthenticatedJsonWebsocketConsumer(AsyncJsonWebsocketConsumer):
    def _token_from_scope(self) -> str:
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        values = parse_qs(query_string).get("token", [])
        return values[0] if values else ""

    @database_sync_to_async
    def _authenticate(self, token):
        if not token:
            return None
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        try:
            result = ClerkJWTAuthentication().authenticate(request)
        except Exception:  # noqa: BLE001
            return None
        return result[0] if result else None


class NotificationConsumer(AuthenticatedJsonWebsocketConsumer):
    async def connect(self):
        token = self._token_from_scope()
        user = await self._authenticate(token)
        if user is None:
            await self.close(code=4401)
            return

        self.user_id = user.id
        self.group_name = f"notifications_user_{self.user_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "notifications.ready"})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "notifications.ping":
            await self.send_json({"type": "notifications.pong"})

    async def notification_created(self, event):
        await self.send_json(
            {
                "type": "notification.created",
                "notification": event["notification"],
            }
        )

class LocationConsumer(AuthenticatedJsonWebsocketConsumer):
    async def connect(self):
        self.user = await self._authenticate(self._token_from_scope())
        if self.user is None:
            await self.close(code=4401, reason="Authentication failed")
            return
        self.business_id = self._int_query("business")
        self.date = parse_date(self._query("date")) or timezone.localdate()
        if not await self._active_member():
            await self.close(code=4403, reason="No active business membership")
            return
        self.admin = await self._is_admin()
        self.group_name = f"locations_business_{self.business_id}"
        if self.admin:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "location.snapshot", "locations": await self._snapshot()})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and getattr(self, "admin", False):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") != "location.update":
            return
        latitude = content.get("latitude")
        longitude = content.get("longitude")
        enabled = bool(content.get("tracking_enabled", True))
        timezone_offset_minutes = content.get("timezone_offset_minutes", 0)
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            await self.send_json({"type": "location.error", "detail": "Numeric coordinates are required."})
            return
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            await self.send_json({"type": "location.error", "detail": "Coordinates are out of range."})
            return
        try:
            timezone_offset_minutes = int(timezone_offset_minutes)
        except (TypeError, ValueError):
            timezone_offset_minutes = 0
        location = await self._save_location(
            float(latitude), float(longitude), enabled, timezone_offset_minutes
        )
        if location is None:
            await self.send_json({"type": "location.error", "detail": "Location updates are allowed only during business hours."})
            return
        payload = await self._serialize(location)
        await self.send_json({"type": "location.updated", "location": payload})
        await self.channel_layer.group_send(self.group_name, {"type": "staff.location", "location": payload})

    async def staff_location(self, event):
        if self.admin and await self._can_view_user(event["location"]["user_id"]):
            await self.send_json({"type": "location.updated", "location": event["location"]})

    def _query(self, key):
        values = parse_qs(self.scope.get("query_string", b"").decode("utf-8")).get(key, [])
        return values[0] if values else ""

    def _int_query(self, key):
        try:
            return int(self._query(key))
        except (TypeError, ValueError):
            return None

    @database_sync_to_async
    def _active_member(self):
        return bool(self.business_id and Membership.objects.filter(
            business_id=self.business_id, user=self.user, status=Membership.Status.ACTIVE
        ).exists())

    @database_sync_to_async
    def _is_admin(self):
        return Membership.objects.filter(
            business_id=self.business_id, user=self.user,
            status=Membership.Status.ACTIVE, role=Membership.Role.ADMIN,
        ).exists()

    @database_sync_to_async
    def _save_location(self, latitude, longitude, enabled, timezone_offset_minutes):
        business = Business.objects.filter(pk=self.business_id).first()
        if business is None:
            return None
        device_now = timezone.now() - timedelta(minutes=timezone_offset_minutes)
        local_time = device_now.time()
        if not (business.working_hours_start <= local_time <= business.working_hours_end):
            return None
        location, _ = StaffLocation.objects.update_or_create(
            business=business, user=self.user,
            defaults={"latitude": latitude, "longitude": longitude, "tracking_enabled": enabled},
        )
        return location

    @database_sync_to_async
    def _serialize(self, location):
        return self._location_payload(location)

    @database_sync_to_async
    def _snapshot(self):
        qs = StaffLocation.objects.filter(business_id=self.business_id, tracking_enabled=True)
        if self.admin:
            assigned_ids = Job.objects.filter(
                business_id=self.business_id, scheduled_at__date=self.date,
                assigned_to__isnull=False,
                status__in=[Job.Status.PENDING, Job.Status.SCHEDULED, Job.Status.IN_PROGRESS],
            ).values_list("assigned_to_id", flat=True)
            qs = qs.filter(Q(user_id__in=assigned_ids) | Q(user=self.user))
        else:
            qs = qs.filter(user=self.user)
        return [self._location_payload(location) for location in qs.select_related("user")]

    @database_sync_to_async
    def _can_view_user(self, user_id):
        if user_id == self.user.id:
            return True
        return Job.objects.filter(
            business_id=self.business_id,
            scheduled_at__date=self.date,
            assigned_to_id=user_id,
            status__in=[Job.Status.PENDING, Job.Status.SCHEDULED, Job.Status.IN_PROGRESS],
        ).exists()

    @staticmethod
    def _location_payload(location):
        age = (timezone.now() - location.updated_at).total_seconds()
        return {
            "user_id": location.user_id,
            "name": f"{location.user.first_name} {location.user.last_name}".strip() or location.user.email,
            "role": "staff",
            "latitude": location.latitude,
            "longitude": location.longitude,
            "updated_at": location.updated_at.isoformat(),
            "status": "live" if age <= 120 else "stale",
        }
