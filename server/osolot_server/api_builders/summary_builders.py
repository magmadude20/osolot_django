from ..api.schemas import (
    CollectiveSummary,
    MembershipSummary,
    PostSharingSummary,
    PostSummary,
    UserSummary,
)
from ..models import Collective, Membership, Post, User


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        friendship_status=user.friendship_status,
    )


def collective_summary(collective: Collective) -> CollectiveSummary:
    try:
        return CollectiveSummary(
            slug=collective.slug,
            name=collective.name,
            description=collective.description,
            visibility=collective.visibility,
            admission_type=collective.admission_type,
            membership_status=collective.membership_status,
            membership_role=collective.membership_role,
        )
    except AttributeError:
        return CollectiveSummary(
            slug=collective.slug,
            name=collective.name,
            description=collective.description,
            visibility=collective.visibility,
            admission_type=collective.admission_type,
        )


def membership_summary(membership: Membership) -> MembershipSummary:
    return MembershipSummary(
        user=user_summary(membership.user),
        collective=collective_summary(membership.collective),
        status=membership.status,
        role=membership.role,
    )


# Post summary for one of the current user's posts, which includes
# the sharing settings.
def my_post_summary(post: Post) -> PostSummary:
    post_summary = PostSummary.from_orm(post)
    post_summary.sharing = PostSharingSummary(
        public=post.public,
        share_with_new_collectives_default=post.share_with_new_collectives_default,
        share_with_new_friends_default=post.share_with_new_friends_default,
    )
    return post_summary


def post_summary(post: Post) -> PostSummary:
    post_summary = PostSummary.from_orm(post)
    # Don't produce sharing info unless specifically viewing user's own posts.
    post_summary.sharing = None
    return post_summary
