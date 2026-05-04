from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import PatchDict, Router
from ninja.errors import HttpError

from ..api_builders.detail_builders import post_detail_for_viewer
from ..api_builders.summary_builders import my_post_summary, post_summary
from ..models import Friendship, Membership, Post
from ..permissions.post_permissions import user_visible_posts
from ..security import JWTAuth, get_optional_user
from .schemas import MessageOut, PostDetail, PostSettings, PostSummary

posts_router = Router()


def _assert_owner(actor, post: Post) -> None:
    if post.owner_id != actor.id:
        raise HttpError(403, "Not allowed.")


def _set_post_shared_collectives(
    actor, post: Post, collective_slugs: list[str]
) -> None:
    if not collective_slugs:
        post.shared_memberships.clear()
        return

    # Dedupe, in case any slugs are repeated
    collective_slugs = set(collective_slugs)
    memberships = list(
        Membership.objects.for_user(actor)
        .filter(status=Membership.Status.ACTIVE)
        .for_collective_slugs(collective_slugs)
    )
    if len(memberships) != len(collective_slugs):
        raise HttpError(400, "Not allowed to share with these collectives.")
    post.shared_memberships.set(memberships)


def _set_post_shared_friends(actor, post: Post, usernames: list[str]) -> None:
    if not usernames:
        post.shared_friendships.clear()
        return

    # Dedupe, in case any usernames are repeated
    usernames = set(usernames)
    friendships = list(
        Friendship.objects.filter(source=actor, target__username__in=usernames)
    )
    if len(friendships) != len(usernames):
        raise HttpError(400, "Not allowed to share with these friends.")
    post.shared_friendships.set(friendships)


@posts_router.get(
    "/mine",
    response=list[PostSummary],
    auth=JWTAuth(),
    tags=["posts"],
    description="List posts owned by the current user.",
)
def list_my_posts(request):
    user = request.auth
    posts = (
        Post.objects.filter(owner=user).select_related("owner").order_by("-created_at")
    )
    return [my_post_summary(p) for p in posts]


@posts_router.get("/", response=list[PostSummary], tags=["posts"])
def list_posts(request):
    viewer = get_optional_user(request)
    posts = user_visible_posts(viewer).select_related("owner").order_by("-created_at")
    return [post_summary(p) for p in posts]


@posts_router.get("/{post_slug}", response=PostDetail, tags=["posts"])
def get_post(request, post_slug: str):
    viewer = get_optional_user(request)
    post = (
        user_visible_posts(viewer)
        .select_related("owner")
        .filter(slug=post_slug)
        .first()
    )
    if post is None:
        raise HttpError(404, "Post not found.")

    return post_detail_for_viewer(post, viewer)


@posts_router.post("/", response=PostDetail, auth=JWTAuth(), tags=["posts"])
def create_post(request, data: PostSettings):
    user = request.auth
    if user.email_verified is False:
        raise HttpError(403, "Verified email required to create a post.")

    with transaction.atomic():
        post = Post.objects.create(
            owner=user,
            type=data.type,
            title=data.title.strip(),
            description=data.description,
            public=data.public,
            share_with_new_collectives_default=data.share_with_new_collectives_default,
            share_with_new_friends_default=data.share_with_new_friends_default,
        )
        _set_post_shared_collectives(user, post, data.shared_collective_slugs)
        _set_post_shared_friends(user, post, data.shared_friend_usernames)
    return post_detail_for_viewer(post, request.auth)


@posts_router.patch("/{post_slug}", response=PostDetail, auth=JWTAuth(), tags=["posts"])
def update_post(request, post_slug: str, data: PatchDict[PostSettings]):
    actor = request.auth
    if actor.email_verified is False:
        raise HttpError(403, "Verified email required to update a post.")

    try:
        post = user_visible_posts(actor).select_related("owner").get(slug=post_slug)
    except Post.DoesNotExist:
        raise HttpError(404, "Post not found.")

    _assert_owner(actor, post)

    update_fields: list[str] = []

    # Post content
    if (title := data.get("title")) and title != post.title:
        post.title = title.strip()
        update_fields.append("title")
    if (type := data.get("type")) and type != post.type:
        post.type = type
        update_fields.append("type")
    if (description := data.get("description")) and description != post.description:
        post.description = description
        update_fields.append("description")

    # Sharing settings
    if (public := data.get("public")) and public != post.public:
        post.public = public
        update_fields.append("public")
    if (
        (
            share_with_new_collectives_default := data.get(
                "share_with_new_collectives_default"
            )
        )
        and share_with_new_collectives_default
        != post.share_with_new_collectives_default
    ):
        post.share_with_new_collectives_default = share_with_new_collectives_default
        update_fields.append("share_with_new_collectives_default")
    if (
        share_with_new_friends_default := data.get("share_with_new_friends_default")
    ) and share_with_new_friends_default != post.share_with_new_friends_default:
        post.share_with_new_friends_default = share_with_new_friends_default
        update_fields.append("share_with_new_friends_default")

    # TODO: Client should only populate the changed fields, especially for
    # collective and friend sharing. Probably not highest priority, since updates
    # should be relatively rare.

    # Collective sharing
    if (shared_collective_slugs := data.get("shared_collective_slugs")) is not None:
        _set_post_shared_collectives(actor, post, shared_collective_slugs)

    # Friend sharing
    if (shared_friend_usernames := data.get("shared_friend_usernames")) is not None:
        _set_post_shared_friends(actor, post, shared_friend_usernames)

    if update_fields:
        post.save(update_fields=update_fields)

    return post_detail_for_viewer(post, actor)


@posts_router.delete(
    "/{post_slug}", response=MessageOut, auth=JWTAuth(), tags=["posts"]
)
def delete_post(request, post_slug: str):
    post = get_object_or_404(Post, slug=post_slug)
    _assert_owner(request.auth, post)
    post.delete()
    return MessageOut(message="Post deleted.")
