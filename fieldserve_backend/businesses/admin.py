from django.contrib import admin

from .models import Business, Membership


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "industry_mode", "created_at")
    list_filter = ("industry_mode",)
    search_fields = ("name", "trading_name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "role", "status", "joined_at")
    list_filter = ("role", "status")
    search_fields = ("user__email", "business__name")
