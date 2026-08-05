from django.urls import path
from rest_framework.routers import DefaultRouter

from .predictions import HeatmapView, ScheduleView
from .views import ChurnLabelViewSet, ChurnScoreViewSet, RetrainRunViewSet

router = DefaultRouter()
router.register(r"churn/scores", ChurnScoreViewSet, basename="churn-score")
router.register(r"churn/labels", ChurnLabelViewSet, basename="churn-label")
router.register(r"retrains", RetrainRunViewSet, basename="retrain-run")

urlpatterns = router.urls + [
    path("predictions/heatmap/", HeatmapView.as_view(), name="predictions-heatmap"),
    path("predictions/schedule/", ScheduleView.as_view(), name="predictions-schedule"),
]
