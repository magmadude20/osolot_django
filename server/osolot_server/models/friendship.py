from django.db import models


# Models one-way friendship from `source` to `target`
class Friendship(models.Model):

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    source = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="friendships_as_source"
    )
    target = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="friendships_as_target"
    )

    # All friendships MUST have both source->target and target->source records.
    # ACTIVE friendships MUST both be ACTIVE.
    # A PENDING_SENT source->target MUST have a PENDING_RECEIVED target->source record.
    # This _may_ be possible to model as a meta constraint, but for now just enforce
    # it in the code.
    class FriendshipStatus(models.TextChoices):
        ACTIVE = "active"
        PENDING_SENT = "pending_sent"
        PENDING_RECEIVED = "pending_received"

    status = models.CharField(
        max_length=31,
        choices=FriendshipStatus.choices,
        default=FriendshipStatus.PENDING_SENT,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "target"], name="unique_friendship"
            )
        ]

    def __str__(self) -> str:
        return f"{self.source.username} -> {self.target.username} ({self.status})"
