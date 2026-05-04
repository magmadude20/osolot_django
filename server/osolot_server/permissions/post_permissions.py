from django.db.models import Q, QuerySet

from ..models import Post, User
from ..permissions.membership_permissions import all_mutual_memberships_with_viewer
from ..permissions.user_permissions import active_friendships_targeting_user

# Query Sets


# All posts visible to `viewer`
def user_visible_posts(viewer: User | None) -> QuerySet[Post]:
    if viewer is None:
        return Post.objects.filter(public=True)

    return Post.objects.filter(
        # Users can see their own posts
        Q(owner=viewer)
        # Users can see public posts
        | Q(public=True)
        # Users can see posts shared with groups they're active members in.
        | Q(
            shared_memberships__in=all_mutual_memberships_with_viewer(
                viewer
            ).values_list("collective", flat=True)
        )
        # Users can see posts shared with them through active friendships.
        | Q(shared_friendships__in=active_friendships_targeting_user(viewer))
    ).distinct()
