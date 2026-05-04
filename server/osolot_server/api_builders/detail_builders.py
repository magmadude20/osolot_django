from django.db.models import QuerySet
from ninja.errors import HttpError

from ..api.schemas import (
    CollectiveDetail,
    MembershipDetail,
    PostDetail,
    PostSharingDetail,
    UserDetail,
)
from ..models import Collective, Friendship, Membership, Post, User
from ..permissions.collective_permissions import (
    membership_can_manage_members,
    user_visible_collective_members,
)
from ..permissions.post_permissions import user_visible_posts
from ..permissions.user_permissions import (
    mutual_collectives_with_user,
    mutual_friends_with_user,
)
from .summary_builders import (
    collective_summary,
    membership_summary,
    post_summary,
    user_summary,
)


# NOTE: Assumes viewer has permission to see the membership.
def membership_detail_for_viewer(
    membership: Membership, viewer: User | None
) -> MembershipDetail:
    viewer_membership = Membership.find_for(viewer, membership.collective)
    # Only users in the collective can see its members.
    if viewer_membership is None:
        raise HttpError(404, "Membership not found.")

    shared_posts = Post.objects.filter(shared_memberships__in=[membership])
    membership_detail = MembershipDetail(
        summary=membership_summary(membership),
        joined_at=membership.joined_at.isoformat() if membership.joined_at else None,
        shared_posts=[post_summary(p) for p in shared_posts],
    )

    is_own_membership = viewer and viewer.id == membership.user.id
    can_see_all_details = is_own_membership or membership_can_manage_members(
        viewer_membership
    )
    if not can_see_all_details:
        return membership_detail

    # Populate full membership details
    membership_detail.application_message = membership.application_message
    membership_detail.applied_at = membership.applied_at.isoformat()
    membership_detail.joined_at = (
        membership.joined_at.isoformat() if membership.joined_at else None
    )
    membership_detail.updated_at = membership.updated_at.isoformat()
    membership_detail.approved_by = (
        user_summary(membership.approved_by) if membership.approved_by else None
    )

    return membership_detail


def _collective_detail_with_members_and_posts(
    collective: Collective, members: QuerySet[Membership], posts: QuerySet[Post]
) -> CollectiveDetail:
    return CollectiveDetail(
        summary=collective_summary(collective),
        members=[membership_summary(m) for m in members],
        application_question=collective.application_question,
        shared_posts=[post_summary(p) for p in posts],
    )


def collective_detail_for_viewer(
    collective: Collective, viewer: User | None
) -> CollectiveDetail:
    visible_members = user_visible_collective_members(viewer, collective)
    visible_posts = user_visible_posts(viewer).filter(
        # Only show posts from active members.
        shared_memberships__in=visible_members.filter(status=Membership.Status.ACTIVE)
    )
    return _collective_detail_with_members_and_posts(
        collective, visible_members, visible_posts
    )


def user_detail_for_viewer(user: User, viewer: User | None) -> UserDetail:
    # Future performance: Fetch mutual collectives and mutual friends in parallel.
    return UserDetail(
        summary=user_summary(user),
        bio=user.bio,
        mutual_collectives=[
            collective_summary(c) for c in mutual_collectives_with_user(viewer, user)
        ],
        mutual_friends=[
            user_summary(u) for u in mutual_friends_with_user(viewer, user)
        ],
        posts_shared_with_me=[
            post_summary(p) for p in user_visible_posts(viewer).filter(owner=user)
        ],
    )


# NOTE: it is assumed that `viewer` has permission to see the post.
def post_detail_for_viewer(post: Post, viewer: User | None) -> PostDetail:
    post_detail = PostDetail.from_orm(post)
    post_detail.owner = user_summary(post.owner)

    if viewer and viewer.id == post.owner_id:
        shared_collectives = Collective.objects.filter(
            id__in=post.shared_memberships.values_list("collective", flat=True)
        )
        shared_friends = User.objects.filter(
            id__in=post.shared_friendships.values_list("target", flat=True)
        )
        post_detail.sharing = PostSharingDetail(
            public=post.public,
            share_with_new_collectives_default=post.share_with_new_collectives_default,
            share_with_new_friends_default=post.share_with_new_friends_default,
            shared_collectives=[collective_summary(c) for c in shared_collectives],
            shared_friends=[user_summary(u) for u in shared_friends],
        )
    else:
        # This is the default, but I'm skeptical of from_orm() starting to populate
        # sharing based on it being a ModelSchema. It doesn't, and this is unnecessary,
        # but it makes me feel better.
        delattr(post_detail, "sharing")

    return post_detail
