from __future__ import annotations

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.core.exceptions import ObjectDoesNotExist

from .models import Notification
from .serializers import NotificationSerializer


@shared_task
def broadcast_notification(notification_id: int) -> None:
    try:
        notification = Notification.objects.get(pk=notification_id)
    except ObjectDoesNotExist:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"notifications_user_{notification.user_id}",
        {
            "type": "notification.created",
            "notification": NotificationSerializer(notification).data,
        },
    )
