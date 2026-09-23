from django.urls import path

from .consumers import LocationConsumer, NotificationConsumer

websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
    path("ws/locations/", LocationConsumer.as_asgi()),
]
