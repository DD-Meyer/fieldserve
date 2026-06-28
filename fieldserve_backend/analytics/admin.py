from django.contrib import admin

from .models import ChurnLabel, ChurnScore, RetrainRun


@admin.register(ChurnScore)
class ChurnScoreAdmin(admin.ModelAdmin):
    list_display = ("customer", "risk_bucket", "probability", "scored_at", "model_name", "model_version")
    list_filter = ("risk_bucket", "model_name")
    search_fields = ("customer__full_name", "customer__email", "model_version")
    date_hierarchy = "scored_at"
    readonly_fields = tuple(f.name for f in ChurnScore._meta.fields)


@admin.register(ChurnLabel)
class ChurnLabelAdmin(admin.ModelAdmin):
    list_display = ("customer", "cutoff_date", "window_days", "churned", "used_in_retrain")
    list_filter = ("churned", "window_days")
    search_fields = ("customer__full_name", "customer__email")
    date_hierarchy = "cutoff_date"


@admin.register(RetrainRun)
class RetrainRunAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "model_name", "n_samples", "triggered_by", "triggered_at", "finished_at")
    list_filter = ("status", "model_name")
    readonly_fields = ("triggered_at",)
    date_hierarchy = "triggered_at"
