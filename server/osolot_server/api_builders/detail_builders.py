from ..api.schemas import CollectiveDetail, MembershipDetail
from ..models import Collective, Membership, User
from ..permissions.collective_permissions import (
    membership_can_manage_members,
    user_visible_collective_members,
    can_view_collective,
)
from .summary_builders import collective_summary, membership_summary, user_summary
from ninja.errors import HttpError

from django.db.models import QuerySet


def _membership_detail(membership: Membership) -> MembershipDetail:
    return MembershipDetail(
        summary=membership_summary(membership),
        application_message=membership.application_message,
        applied_at=membership.applied_at.isoformat(),
        joined_at=membership.joined_at.isoformat() if membership.joined_at else None,
        updated_at=membership.updated_at.isoformat(),
        approved_by=(
            user_summary(membership.approved_by) if membership.approved_by else None
        ),
    )


def membership_detail_for_viewer(
    membership: Membership, viewer: User | None
) -> MembershipDetail:
    membership_detail = _membership_detail(membership)

    # Users can see all details of their own membership.
    if viewer and viewer.id == membership.user.id:
        return membership_detail

    viewer_membership = Membership.find_for(viewer, membership.collective)
    if (
        viewer_membership is None
        and membership.collective.visibility == Collective.Visibility.PRIVATE
    ):
        raise HttpError(404, "Membership not found.")

    # Redact admin/moderator-only fields.
    if not membership_can_manage_members(viewer_membership):
        delattr(membership_detail, "applied_at")
        delattr(membership_detail, "updated_at")
        delattr(membership_detail, "application_message")
        delattr(membership_detail, "approved_by")

    return membership_detail


def _collective_detail_with_members(
    collective: Collective, members: QuerySet[Membership]
) -> CollectiveDetail:
    return CollectiveDetail(
        summary=collective_summary(collective),
        members=[membership_summary(m) for m in members],
        application_question=collective.application_question,
    )


# TODO: allow some way for users to view / request to join private collectives.
# Something like an access code? Or maybe an INVITED status?
# Likely have use cases for both 1) 'join-by-link' 2) invite-only
def collective_detail_for_viewer(
    collective: Collective, viewer: User | None
) -> CollectiveDetail:
    if not can_view_collective(viewer, collective):
        raise HttpError(404, "Collective not found.")
    visible_members = user_visible_collective_members(viewer, collective)
    return _collective_detail_with_members(collective, visible_members)
