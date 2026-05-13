from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..api_builders.detail_builders import membership_detail_for_viewer
from ..api_builders.summary_builders import membership_summary
from ..models import Collective, Membership, Post, User
from ..permissions.collective_permissions import (
    can_manage_member_roles,
    can_manage_members,
    can_manage_memberships,
    membership_can_manage_members,
    user_visible_collective_members,
)
from ..security import JWTAuth, get_optional_user
from .schemas import (
    JoinCollectiveRequest,
    MembershipDetail,
    MembershipSummary,
    MessageOut,
    UpdateMembershipRequest,
)

collective_memberships_router = Router()


# TODO: Fix this method
def _set_shared_posts_for_membership(
    user: User, membership: Membership, post_slugs: list[str]
) -> None:
    slug_set = set(post_slugs)
    posts_to_share = list(Post.objects.filter(owner=user, slug__in=slug_set))
    if len(posts_to_share) != len(slug_set):
        raise HttpError(400, "One or more posts are invalid or not owned by you.")
    membership.shared_posts.set(posts_to_share)


# This method may not be needed, since getting a collective already gives all membership summaries.
# It could be used in the future for pagination.
# At this point, it's already here and shouldn't be hurting anything, so leaving it.
@collective_memberships_router.get(
    "/{collective_slug}/members",
    response=list[MembershipSummary],
    tags=["collectives"],
)
def list_memberships(request, collective_slug: str):
    collective = get_object_or_404(Collective, slug=collective_slug)
    user = get_optional_user(request)

    visible_members = user_visible_collective_members(user, collective)
    return [membership_summary(m) for m in visible_members]


@collective_memberships_router.post(
    "/{collective_slug}/join",
    response=MembershipDetail,
    auth=JWTAuth(),
    tags=["collectives"],
)
def join_collective(request, collective_slug: str, data: JoinCollectiveRequest):
    collective = get_object_or_404(Collective, slug=collective_slug)
    user = request.auth

    if Membership.find_for(user, collective) is not None:
        raise HttpError(400, "Already a member or have a pending application.")

    with transaction.atomic():
        if collective.admission_type == Collective.AdmissionType.OPEN:
            membership = Membership.objects.create(
                collective=collective,
                user=user,
                status=Membership.Status.ACTIVE,
                role=Membership.Role.MEMBER,
                joined_at=timezone.now(),
            )
        else:
            membership = Membership.objects.create(
                collective=collective,
                user=user,
                status=Membership.Status.PENDING,
                role=Membership.Role.MEMBER,
                application_message=data.application_message,
            )
        _set_shared_posts_for_membership(user, membership, data.shared_post_slugs)
    return membership_detail_for_viewer(membership, user)


@collective_memberships_router.get(
    "/{collective_slug}/membership/{username}",
    response=MembershipDetail,
    tags=["memberships"],
)
def get_membership(request, collective_slug: str, username: str):
    collective = get_object_or_404(Collective, slug=collective_slug)
    viewer = get_optional_user(request)

    visible_user_membership = (
        user_visible_collective_members(viewer, collective)
        .filter(user__username=username)
        .first()
    )
    if visible_user_membership is None:
        raise HttpError(404, "Membership not found.")

    return membership_detail_for_viewer(visible_user_membership, viewer)


@collective_memberships_router.put(
    "/{collective_slug}/membership/{username}",
    response=MembershipDetail,
    auth=JWTAuth(),
    tags=["memberships"],
)
def update_membership(
    request, collective_slug: str, username: str, data: UpdateMembershipRequest
):
    # Validate request
    if data.status is not None and data.status not in Membership.Status.values:
        raise HttpError(400, "Invalid status.")
    if data.role is not None and data.role not in Membership.Role.values:
        raise HttpError(400, "Invalid role.")

    user_membership = get_object_or_404(
        Membership.objects.select_related("collective", "user"),
        collective__slug=collective_slug,
        user__username=username,
    )
    collective = user_membership.collective
    user = user_membership.user

    actor = request.auth
    if actor.id == user.id:
        actor_membership = user_membership
    else:
        actor_membership = Membership.find_for(actor, collective)
        if actor_membership is None:
            raise HttpError(403, "Not allowed.")

    updates = data.model_dump(exclude_unset=True)

    if (application_message := updates.get("application_message")) is not None:
        if actor.id != user.id:
            # Only pending applicants may update their own application message.
            raise HttpError(403, "Not allowed.")
        if user_membership.status != Membership.Status.PENDING:
            raise HttpError(
                400, "Only pending members can update their application message."
            )
        user_membership.application_message = application_message

    if (shared_post_slugs := updates.get("shared_post_slugs")) is not None:
        if actor.id != user.id:
            # Only members can update the posts they share.
            raise HttpError(403, "Not allowed.")
        _set_shared_posts_for_membership(user, user_membership, shared_post_slugs)

    if (status := updates.get("status")) is not None:
        if not membership_can_manage_members(actor_membership):
            raise HttpError(403, "Not allowed.")
        if (
            user_membership.status == Membership.Status.PENDING
            and status == Membership.Status.ACTIVE
        ):
            user_membership.joined_at = timezone.now()
            user_membership.status = status
            user_membership.approved_by = actor
        else:
            # Only allow updating status from PENDING -> ACTIVE (for now)
            pass

    if (role := updates.get("role")) is not None:
        if not can_manage_member_roles(actor_membership):
            raise HttpError(403, "Only admins can change roles.")

        collective_admins = Membership.objects.for_collective(collective).admins()
        if (
            collective_admins.count() == 1
            and collective_admins.first().id == user_membership.id
        ):
            raise HttpError(400, "Cannot demote the last admin.")
        user_membership.role = role

    # Handle race condition of two admins being demoted at the same time.
    # Probably overkill, and we're ignoring race conditions elsewhere, but whatever.
    with transaction.atomic():
        user_membership.save()
        if not Membership.objects.filter(
            collective=collective,
            status=Membership.Status.ACTIVE,
            role=Membership.Role.ADMIN,
        ).exists():
            raise HttpError(400, "Collective must have at least one active admin.")
    return membership_detail_for_viewer(user_membership, actor)


@collective_memberships_router.delete(
    "/{collective_slug}/membership/{username}",
    response=MessageOut,
    auth=JWTAuth(),
    tags=["memberships"],
)
def delete_membership(request, collective_slug: str, username: str):
    actor = request.auth

    actor_membership = (
        Membership.objects.select_related("collective")
        .filter(user=actor, collective__slug=collective_slug)
        .first()
    )
    if actor_membership is None:
        raise HttpError(403, "Not allowed.")

    if actor.username != username and not can_manage_members(
        actor_membership.status, actor_membership.role
    ):
        raise HttpError(403, "Not allowed.")

    user_membership = (
        Membership.objects.select_related("collective")
        .filter(user__username=username, collective__slug=collective_slug)
        .first()
    )
    if user_membership is None:
        raise HttpError(404, "Membership not found.")

    if user_membership.role == Membership.Role.ADMIN:
        collective_admins = Membership.objects.filter(
            collective__slug=collective_slug, role=Membership.Role.ADMIN
        ).count()
        if collective_admins.count() <= 1:
            raise HttpError(400, "Cannot remove the last admin.")

    # Handle race condition of two admins leaving at the same time.
    # Probably overkill, and we're ignoring race conditions elsewhere, but whatever.
    with transaction.atomic():
        user_membership.delete()
        if not Membership.objects.filter(
            collective__slug=collective_slug,
            status=Membership.Status.ACTIVE,
            role=Membership.Role.ADMIN,
        ).exists():
            raise HttpError(400, "Collective must have at least one active admin.")

    return MessageOut(message="Member removed.")
