from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from businesses.views import BusinessViewSet
from jobs.views import JobViewSet
from users.views import CustomerViewSet, MeView, RegisterView

router = DefaultRouter()
router.register(r"jobs", JobViewSet, basename="job")
router.register(r"businesses", BusinessViewSet, basename="business")
router.register(r"customers", CustomerViewSet, basename="customer")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/", include(router.urls)),
]
