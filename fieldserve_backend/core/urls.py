from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.routers import DefaultRouter

from businesses.views import BusinessViewSet, ServiceViewSet
from inspections.views import InspectionViewSet
from jobs.views import JobViewSet
from users.views import CustomerViewSet, MeView, OnboardUserView
from users.webhooks import ClerkWebhookView

# Helper to enforce CORS on static media files
def cors_serve(request, path, document_root=None, show_indexes=False):
    response = serve(request, path, document_root=document_root, show_indexes=show_indexes)
    response["Access-Control-Allow-Origin"] = "*"
    return response

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

if settings.STORAGES["default"]["BACKEND"] == "django.core.files.storage.FileSystemStorage":
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            cors_serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
