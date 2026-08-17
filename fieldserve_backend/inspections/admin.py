from django.contrib import admin

from .models import Inspection


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "job",
        "phase",
        "angle",
        "analysis_status",
        "damage_count",
        "created_at",
    )
    list_filter = ("phase", "angle", "analysis_status")
    readonly_fields = ("analysis", "analysis_status", "analysis_error", "created_at", "updated_at")
    search_fields = ("job__id",)

    def damage_count(self, obj: Inspection) -> int:  # type: ignore[override]
        return obj.damage_count
