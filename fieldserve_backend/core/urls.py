from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from businesses.views import BusinessViewSet
from jobs.views import JobViewSet
from users.views import CustomerViewSet, MeView
from users.webhooks import ClerkWebhookView

router = DefaultRouter()
router.register(r"jobs", JobViewSet, basename="job")
router.register(r"businesses", BusinessViewSet, basename="business")
router.register(r"customers", CustomerViewSet, basename="customer")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/webhooks/clerk/", ClerkWebhookView.as_view(), name="clerk-webhook"),
    path("api/", include(router.urls)),
]
