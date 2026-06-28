from rest_framework.routers import DefaultRouter

from .views import ChurnLabelViewSet, ChurnScoreViewSet, RetrainRunViewSet

router = DefaultRouter()
router.register(r"churn/scores", ChurnScoreViewSet, basename="churn-score")
router.register(r"churn/labels", ChurnLabelViewSet, basename="churn-label")
router.register(r"retrains", RetrainRunViewSet, basename="retrain-run")

urlpatterns = router.urls
