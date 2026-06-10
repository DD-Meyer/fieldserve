from django.contrib.gis import admin as gis_admin

from .models import Job


@gis_admin.register(Job)
class JobAdmin(gis_admin.GISModelAdmin):
    list_display = ("id", "service_type", "status", "scheduled_at", "assigned_to")
    list_filter = ("status", "service_type")
    search_fields = ("service_type", "notes", "customer__full_name")
