from ..models import Collective, Membership, User

from django.db.models import Q, QuerySet


# Admins can manage collective member roles
def can_manage_member_roles(membership: Membership) -> bool:
    return (
        membership.status == Membership.Status.ACTIVE
        and membership.role == Membership.Role.ADMIN
    )


# Active admins and moderators can manage collective members
def membership_can_manage_members(membership: Membership | None) -> bool:
    if membership is None:
        return False
    return membership.status == Membership.Status.ACTIVE and membership.role in (
        Membership.Role.ADMIN,
        Membership.Role.MODERATOR,
    )


def can_manage_memberships(user: User, collective: Collective) -> bool:
    return membership_can_manage_members(Membership.find_for(user, collective))


# Query Sets


# Visible collectives for user:
# Public collectives can be seen by everyone
# Private collectives can be seen by members (including pending members)
def user_visible_collectives(viewer: User | None) -> QuerySet[Membership]:
    if viewer is None:
        return Collective.objects.filter(visibility=Collective.Visibility.PUBLIC)
    return Collective.objects.filter(
        Q(visibility=Collective.Visibility.PUBLIC) | Q(members=viewer)
    ).distinct()


# Collective member visibility:
# Admins and mods can see all members
# Pending members can only see their membership
# Members can see other active members
# Anyone can see public collectives active users
# Only members can see a private collectives members
def user_visible_collective_members(
    viewer: User | None, collective: Collective
) -> QuerySet[Membership]:
    collective_members = Membership.objects.for_collective(collective).select_related(
        "user", "collective"
    )

    viewer_membership_query = collective_members.filter(user=viewer)
    # Optimization: Don't use exists() to prevent second lookup when getting membership
    # See: https://docs.djangoproject.com/en/6.0/ref/models/querysets/#django.db.models.query.QuerySet.exists
    if not viewer_membership_query:
        # Viewer is NOT a member of the collective.
        return collective_members.none()

    # Use [0] instead of first(), since first() causes another db query.
    # I don't think it _should_, but that's what happens in testing.
    viewer_membership = viewer_membership_query[0]

    # Pending users can only see their own membership.
    if viewer_membership.status != Membership.Status.ACTIVE:
        return viewer_membership_query

    if membership_can_manage_members(viewer_membership):
        # Admins/moderators can see all members
        return collective_members

    # Regular members can see active members
    return collective_members.filter(status=Membership.Status.ACTIVE)
