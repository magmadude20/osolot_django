from django.db import models
from django.db.models import Q

from .user import User


# Models one-way friendship from `source` to `target`
class Friendship(models.Model):

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    source = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friendships_as_source"
    )
    target = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friendships_as_target"
    )

    # An ACTIVE friendship MUST be bidirectional (users are friends with each other).
    # A PENDING friendship MUST be one-way (one user sends a request to the other).
    # This _may_ be possible to model as a meta constraint, but for now just enforce
    # it in the code.
    class FriendshipStatus(models.TextChoices):
        ACTIVE = "active"
        REQUESTED = "requested"

    status = models.CharField(
        max_length=31,
        choices=FriendshipStatus.choices,
        default=FriendshipStatus.REQUESTED,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "target"], name="unique_friendship"
            )
        ]

    def __str__(self) -> str:
        return f"{self.source.username} -> {self.target.username} ({self.status})"
