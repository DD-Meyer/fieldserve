from django.contrib import admin

from .models import Business, Membership, Service


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "industry_mode", "public_booking_enabled", "created_at")
    list_filter = ("industry_mode", "public_booking_enabled")
    search_fields = ("name", "trading_name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "role", "status", "joined_at")
    list_filter = ("role", "status")
    search_fields = ("user__email", "business__name")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "price", "duration_minutes", "is_active")
    list_filter = ("is_active", "business")
    search_fields = ("name", "business__name")
    prepopulated_fields = {"slug": ("name",)}
