from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Collective, Membership, User


class CollectiveMembershipInline(admin.TabularInline):
    """Memberships for this collective (members list on the collective change page)."""

    model = Membership
    extra = 0
    fields = (
        "user",
        "status",
        "role",
        "approved_by",
        "applied_at",
        "joined_at",
        "updated_at",
    )
    autocomplete_fields = ("user", "approved_by")
    readonly_fields = ("applied_at", "joined_at", "updated_at")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user")
            .order_by("user__email")
        )


class UserMembershipInline(admin.TabularInline):
    """Collectives this user belongs to (from the user change page)."""

    model = Membership
    fk_name = "user"
    extra = 0
    fields = (
        "collective",
        "status",
        "role",
        "approved_by",
        "applied_at",
        "joined_at",
        "updated_at",
    )
    autocomplete_fields = ("collective", "approved_by")
    readonly_fields = ("applied_at", "joined_at", "updated_at")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("collective")
            .order_by("collective__name")
        )


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        *DjangoUserAdmin.fieldsets,
        ("Profile", {"fields": ("email_verified",)}),
    )
    list_display = ("email", "email_verified", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    inlines = (*DjangoUserAdmin.inlines, UserMembershipInline)


@admin.register(Collective)
class CollectiveAdmin(admin.ModelAdmin):
    list_display = ("name", "visibility", "admission_type")
    list_filter = ("visibility", "admission_type")
    search_fields = ("name",)
    inlines = (CollectiveMembershipInline,)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "collective", "status", "role", "approved_by")
    list_filter = ("status", "role")
    search_fields = ("user__email", "collective__name")
    autocomplete_fields = ("user", "collective", "approved_by")
