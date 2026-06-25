from django.contrib.gis import admin as gis_admin

from .models import Job


@gis_admin.register(Job)
class JobAdmin(gis_admin.GISModelAdmin):
    list_display = (
        "id",
        "service_type",
        "customer",
        "business",
        "assigned_to",
        "scheduled_at",
        "status",
        "price",
    )
    list_filter = ("status", "business")
    search_fields = ("service_type", "notes", "customer__full_name")
    date_hierarchy = "scheduled_at"
