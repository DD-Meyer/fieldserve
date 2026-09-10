"""Clerk webhook handler — mirrors user lifecycle into local DB."""

from __future__ import annotations

import json
import logging

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from svix.webhooks import Webhook, WebhookVerificationError

from businesses.models import Business, Membership

from .models import User

log = logging.getLogger(__name__)


def _primary_email(data: dict) -> str:
    addrs = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    for a in addrs:
        if a.get("id") == primary_id:
            return a.get("email_address", "")
    return addrs[0].get("email_address", "") if addrs else ""


@method_decorator(csrf_exempt, name="dispatch")
class ClerkWebhookView(View):
    def post(self, request: HttpRequest) -> HttpResponse:
        secret = getattr(settings, "CLERK_WEBHOOK_SECRET", "")
        if not secret:
            return JsonResponse({"detail": "webhook secret not configured"}, status=503)

        payload = request.body
        headers = {k: v for k, v in request.headers.items()}
        try:
            evt = Webhook(secret).verify(payload, headers)
        except WebhookVerificationError as exc:
            return JsonResponse({"detail": f"invalid signature: {exc}"}, status=400)
        except Exception as exc:  # noqa: BLE001
            return JsonResponse({"detail": f"verify failed: {exc}"}, status=400)

        try:
            event_type = evt.get("type")
            data = evt.get("data") or {}
        except AttributeError:
            # svix returns dict but some clients give str
            body = json.loads(payload)
            event_type = body.get("type")
            data = body.get("data") or {}

        handler = {
            "user.created": self._user_created,
            "user.updated": self._user_updated,
            "user.deleted": self._user_deleted,
            "organizationMembership.created": self._membership_created_or_updated,
            "organizationMembership.updated": self._membership_created_or_updated,
            "organizationMembership.deleted": self._membership_deleted,
        }.get(event_type)

        if handler is None:
            return JsonResponse({"ok": True, "ignored": event_type})

        try:
            handler(data)
        except Exception:  # noqa: BLE001
            log.exception("Clerk webhook handler failed for %s", event_type)
            return JsonResponse({"detail": "handler failed"}, status=500)
        return JsonResponse({"ok": True, "event": event_type})

    # ---- handlers --------------------------------------------------

    def _user_created(self, data: dict) -> None:
        clerk_id = data.get("id")
        if not clerk_id:
            return
        email = _primary_email(data)
        first = data.get("first_name") or ""
        last = data.get("last_name") or ""
        user, _ = User.objects.update_or_create(
            clerk_user_id=clerk_id,
            defaults={
                "username": clerk_id,
                "email": email,
                "first_name": first,
                "last_name": last,
                "avatar_url": data.get("image_url") or "",
            },
        )
    def _user_updated(self, data: dict) -> None:
        clerk_id = data.get("id")
        if not clerk_id:
            return
        User.objects.filter(clerk_user_id=clerk_id).update(
            email=_primary_email(data),
            first_name=data.get("first_name") or "",
            last_name=data.get("last_name") or "",
            avatar_url=data.get("image_url") or "",
        )

    def _user_deleted(self, data: dict) -> None:
        clerk_id = data.get("id")
        if not clerk_id:
            return
        User.objects.filter(clerk_user_id=clerk_id).update(is_active=False)

    def _membership_created_or_updated(self, data: dict) -> None:
        organization = data.get("organization") or {}
        user_data = data.get("public_user_data") or {}
        organization_id = organization.get("id")
        clerk_user_id = user_data.get("user_id")
        if not organization_id or not clerk_user_id:
            return
        business = Business.objects.filter(clerk_organization_id=organization_id).first()
        if business is None:
            return
        email = (user_data.get("identifier") or "").lower()
        user, _ = User.objects.get_or_create(
            clerk_user_id=clerk_user_id,
            defaults={"username": clerk_user_id, "email": email},
        )
        role = Membership.Role.ADMIN if data.get("role") == "org:admin" else Membership.Role.STAFF
        membership = Membership.objects.filter(business=business, user=user).first()
        if membership is None and email:
            membership = business.memberships.filter(
                invited_email__iexact=email,
                status=Membership.Status.INVITED,
            ).first()
        if membership is None:
            Membership.objects.create(
                business=business,
                user=user,
                role=role,
                status=Membership.Status.ACTIVE,
            )
            return
        membership.user = user
        membership.role = role
        membership.status = Membership.Status.ACTIVE
        membership.save(update_fields=["user", "role", "status"])

    def _membership_deleted(self, data: dict) -> None:
        organization = data.get("organization") or {}
        user_data = data.get("public_user_data") or {}
        organization_id = organization.get("id")
        clerk_user_id = user_data.get("user_id")
        if not organization_id or not clerk_user_id:
            return
        Membership.objects.filter(
            business__clerk_organization_id=organization_id,
            user__clerk_user_id=clerk_user_id,
        ).exclude(user_id=Business.objects.filter(clerk_organization_id=organization_id).values("owner_id")).update(
            status=Membership.Status.INACTIVE
        )
