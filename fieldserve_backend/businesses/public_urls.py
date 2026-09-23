from django.urls import path

from .public_views import (
    public_booking_create,
    public_business_detail,
    public_check_slot,
    public_lookup_customer,
    public_places_autocomplete,
    public_places_details,
    public_service_list,
    public_suggest_slots,
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
    path(
        "businesses/<slug:slug>/check-slot/",
        public_check_slot,
        name="public-check-slot",
    ),
    path(
        "businesses/<slug:slug>/suggest-slots/",
        public_suggest_slots,
        name="public-suggest-slots",
    ),
    path(
        "businesses/<slug:slug>/lookup-customer/",
        public_lookup_customer,
        name="public-lookup-customer",
    ),
    path(
        "places/autocomplete/",
        public_places_autocomplete,
        name="public-places-autocomplete",
    ),
    path(
        "places/details/",
        public_places_details,
        name="public-places-details",
    ),
]
