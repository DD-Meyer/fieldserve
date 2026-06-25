from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Customer, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "clerk_user_id", "is_staff", "is_active")
    search_fields = ("username", "email", "clerk_user_id")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("FieldServe", {"fields": ("clerk_user_id", "phone", "avatar_url")}),
    )


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "business", "email", "phone", "created_at")
    list_filter = ("business",)
    search_fields = ("full_name", "email", "phone")
