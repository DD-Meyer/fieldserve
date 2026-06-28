from django.urls import path

from .public_views import (
    public_booking_create,
    public_business_detail,
    public_service_list,
)

urlpatterns = [
    path(
        "businesses/<slug:slug>/",
        public_business_detail,
        name="public-business-detail",
    ),
    path(
        "businesses/<slug:slug>/services/",
        public_service_list,
        name="public-service-list",
    ),
    path(
        "businesses/<slug:slug>/bookings/",
        public_booking_create,
        name="public-booking-create",
    ),
]
