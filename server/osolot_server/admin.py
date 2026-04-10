from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (*DjangoUserAdmin.fieldsets, ("Profile", {"fields": ("email_verified",)}))
    list_display = ("email", "email_verified", "is_staff")
    search_fields = ("email", "first_name", "last_name")
