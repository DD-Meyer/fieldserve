from __future__ import annotations

import logging
from collections.abc import Iterable

from businesses.models import Business, Membership
from django.db import transaction

from .models import Notification, User

log = logging.getLogger(__name__)


def create_notification(
    user: User,
    *,
    title: str,
    message: str = "",
) -> Notification:
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
    )
    transaction.on_commit(
        lambda: _queue_notification_broadcast(notification.pk)
    )
    return notification


def _queue_notification_broadcast(notification_id: int) -> None:
    from .tasks import broadcast_notification

    try:
        broadcast_notification.delay(notification_id)
    except Exception:  # noqa: BLE001
        log.exception("Could not queue notification broadcast %s", notification_id)


def notify_business_members(
    business: Business,
    *,
    title: str,
    message: str = "",
    exclude: Iterable[User] = (),
) -> list[Notification]:
    excluded_ids = {user.id for user in exclude if user is not None and user.id}
    members = User.objects.filter(
        memberships__business=business,
        memberships__status=Membership.Status.ACTIVE,
    ).distinct()
    if excluded_ids:
        members = members.exclude(id__in=excluded_ids)

    return [
        create_notification(user, title=title, message=message)
        for user in members
    ]
