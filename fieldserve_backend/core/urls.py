from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from businesses.views import BusinessViewSet, ServiceViewSet
from inspections.views import InspectionViewSet
from jobs.views import JobViewSet
from users.views import CustomerViewSet, MeView, OnboardUserView
from users.webhooks import ClerkWebhookView

router = DefaultRouter()
router.register(r"jobs", JobViewSet, basename="job")
router.register(r"businesses", BusinessViewSet, basename="business")
router.register(r"services", ServiceViewSet, basename="service")
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"inspections", InspectionViewSet, basename="inspection")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/v1/users/onboard/", OnboardUserView.as_view(), name="onboard-user"),
    path("api/webhooks/clerk/", ClerkWebhookView.as_view(), name="clerk-webhook"),
    path("api/", include(router.urls)),
    path("api/public/", include("businesses.public_urls")),
    path("api/analytics/", include("analytics.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
