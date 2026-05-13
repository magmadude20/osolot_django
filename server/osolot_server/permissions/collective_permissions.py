from django.db.models import Q, QuerySet

from ..models import Collective, Membership, User


# Admins can manage collective member roles
def can_manage_member_roles(membership: Membership) -> bool:
    return (
        membership.status == Membership.Status.ACTIVE
        and membership.role == Membership.Role.ADMIN
    )


# Active admins and moderators can manage collective members
def can_manage_members(status: Membership.Status, role: Membership.Role) -> bool:
    return status == Membership.Status.ACTIVE and role in (
        Membership.Role.ADMIN,
        Membership.Role.MODERATOR,
    )


def can_manage_memberships(user: User, collective: Collective) -> bool:
    membership = Membership.find_for(user, collective)
    if membership is None:
        return False
    return can_manage_members(membership.status, membership.role)


# Query Sets


# Visible collectives for user:
# Public collectives can be seen by everyone
# Private collectives can be seen by members (including pending members)
def user_visible_collectives(viewer: User | None) -> QuerySet[Membership]:
    return (
        Collective.objects.with_user_membership(viewer)
        .filter(Q(visibility=Collective.Visibility.PUBLIC) | Q(members=viewer))
        .distinct()
    )


# Collective member visibility:
# Admins and mods can see all members
# Pending members can only see their membership
# Members can see other active members
# Anyone can see public collectives active users
# Only members can see a private collectives members
def user_visible_collective_members(
    viewer: User | None, collective: Collective
) -> QuerySet[Membership]:
    collective_members = User.objects.with_collective_membership(collective)

    viewer_membership = collective_members.filter(user=viewer).first()
    # Optimization: Don't use exists() to prevent second lookup when getting membership
    # See: https://docs.djangoproject.com/en/6.0/ref/models/querysets/#django.db.models.query.QuerySet.exists
    if viewer_membership is None:
        # Viewer is NOT a member of the collective.
        return collective_members.none()

    # Pending users can only see their own membership.
    if viewer_membership.status != Membership.Status.ACTIVE:
        # Copy of viewer_membership assignment, w/o first()
        return collective_members.filter(user=viewer)

    if membership_can_manage_members(viewer_membership):
        # Admins/moderators can see all members
        return collective_members

    # Regular members can see active members
    return collective_members.filter(status=Membership.Status.ACTIVE)
