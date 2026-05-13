from __future__ import annotations

from django.db import models

from .user import User


class MembershipQuerySet(models.QuerySet):
    def for_collective(self, collective):
        return self.filter(collective=collective)

    def for_collective_slugs(self, collective_slugs):
        return self.filter(collective__slug__in=collective_slugs)

    def for_user(self, user: User):
        return self.filter(user=user)

    def admins(self):
        return self.filter(status=Membership.Status.ACTIVE, role=Membership.Role.ADMIN)


class Membership(models.Model):
    objects = MembershipQuerySet.as_manager()

    collective = models.ForeignKey("Collective", on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    # Timestamps
    applied_at = models.DateTimeField(auto_now_add=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Application info
    application_message = models.TextField(
        blank=True, help_text="Message accompanying an application."
    )
    approved_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="memberships_approved",
    )

    # Membership info

    class Status(models.TextChoices):
        ACTIVE = "active"
        PENDING = "pending"
        # BANNED = "banned" -- Can add in the future
        # REJECTED = "rejected" -- just delete the row for now

    status = models.CharField(
        max_length=31, choices=Status.choices, default=Status.ACTIVE
    )

    class Role(models.TextChoices):
        ADMIN = "admin"
        MODERATOR = "moderator"
        MEMBER = "member"

    role = models.CharField(max_length=31, choices=Role.choices, default=Role.MEMBER)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["collective", "user"], name="unique_collective_user"
            )
        ]

        indexes = [
            models.Index(fields=["collective", "user"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} in {self.collective.name}"

    @classmethod
    def find_for(
        cls, user: User | None, collective: Collective | None
    ) -> Membership | None:
        if user is None or collective is None:
            return None
        return cls.objects.filter(user=user, collective=collective).first()

    @classmethod
    def find_for_ids(cls, user_id: int, collective_id: int) -> Membership | None:
        return cls.objects.filter(user_id=user_id, collective_id=collective_id).first()

    @classmethod
    def find_for_user_and_collective_slug(
        cls, user_id: int, collective_slug: str
    ) -> Membership | None:
        return (
            cls.objects.filter(user_id=user_id, collective__slug=collective_slug)
            .select_related("collective", "user")
            .first()
        )

    @classmethod
    def find_for_username_and_collective_slug(
        cls, username: str, collective_slug: str
    ) -> Membership | None:
        return (
            cls.objects.filter(
                user__username=username, collective__slug=collective_slug
            )
            .select_related("collective", "user")
            .first()
        )
