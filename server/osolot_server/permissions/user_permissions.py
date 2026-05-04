from django.db.models import QuerySet

from ..models import Collective, Friendship, User
from ..permissions.membership_permissions import all_mutual_memberships_with_viewer


# Collectives in common between viewer and user.
def mutual_collectives_with_user(
    viewer: User | None, user: User
) -> QuerySet[Collective]:
    return Collective.objects.filter(
        id__in=all_mutual_memberships_with_viewer(viewer)
        .filter(user=user)
        .values_list("collective", flat=True)
    )


# All users who share a collective with viewer.
# Both users must have an ACTIVE status in the collective.
def mutual_collective_users_for_viewer(viewer: User | None) -> QuerySet[User]:
    return User.objects.filter(
        id__in=all_mutual_memberships_with_viewer(viewer).values_list("user", flat=True)
    )


def active_friendships_targeting_user(user: User) -> QuerySet[Friendship]:
    return Friendship.objects.filter(
        target=user, status=Friendship.FriendshipStatus.ACTIVE
    )


# Mutual friends between `viewer` and `user`
def mutual_friends_with_user(viewer: User | None, user: User) -> QuerySet[User]:
    if viewer is None:
        return User.objects.none()

    viewer_friends = active_friendships_targeting_user(viewer)
    user_friends = active_friendships_targeting_user(user)

    # There is no intersection in the Friendship objects between viewer_friends
    # and user_friends, but we're only selecting the `source` user from each, so
    # the intersection is run on only that field (and thus produces the expected result).
    return User.objects.filter(
        id__in=viewer_friends.intersection(user_friends).values_list(
            "source", flat=True
        )
    )
