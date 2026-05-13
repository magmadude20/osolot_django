import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from ..api_builders.detail_builders import user_detail_for_viewer
from ..api_builders.exceptions import validation_error_to_http_error
from ..api_builders.summary_builders import membership_summary, user_summary
from ..models import Friendship, Membership
from ..security import JWTAuth, get_optional_user
from .schemas import (
    MembershipSummary,
    MessageOut,
    UpdateProfileRequest,
    UserDetail,
    UserProfile,
    UserSummary,
)

logger = logging.getLogger(__name__)

User = get_user_model()

users_router = Router()


@users_router.get("/my/profile", response=UserProfile, auth=JWTAuth(), tags=["users"])
def me(request):
    return UserProfile.from_orm(request.auth)


@users_router.patch("/my/profile", response=UserProfile, auth=JWTAuth(), tags=["users"])
def update_me(request, data: UpdateProfileRequest):
    user: User = request.auth
    update_fields: list[str] = []

    if data.first_name is not None:
        new_first_name = (data.first_name or "").strip()
        if new_first_name != user.first_name:
            user.first_name = new_first_name
            update_fields.append("first_name")

    if data.last_name is not None:
        new_last_name = (data.last_name or "").strip()
        if new_last_name != user.last_name:
            user.last_name = new_last_name
            update_fields.append("last_name")

    if data.username is not None:
        new_username = (data.username or "").strip()
        if new_username != user.username:
            user.username = new_username
            update_fields.append("username")

    if data.bio is not None:
        new_bio = (data.bio or "").strip()
        if new_bio != user.bio:
            user.bio = new_bio
            update_fields.append("bio")

    if update_fields:
        try:
            user.save(update_fields=update_fields)
        except ValidationError as e:
            raise validation_error_to_http_error(e) from None
        except IntegrityError:
            raise HttpError(400, "That username is already taken.") from None

    return UserProfile.from_orm(user)


@users_router.get(
    "/my/memberships",
    response=list[MembershipSummary],
    auth=JWTAuth(),
    tags=["users"],
    description="List all memberships for the current user, including pending memberships.",
)
def list_my_memberships(request):
    user = request.auth
    memberships = Membership.objects.filter(user=user).select_related(
        "user", "collective"
    )
    return [membership_summary(m) for m in memberships]


@users_router.get(
    "/my/friends", response=list[UserSummary], auth=JWTAuth(), tags=["users"]
)
def list_my_friends(request):
    user = request.auth
    friends = Friendship.objects.filter(
        source=user, status=Friendship.FriendshipStatus.ACTIVE
    ).select_related("target")
    return [user_summary(f.target) for f in friends]


@users_router.get(
    "/my/friend-requests", response=list[UserSummary], auth=JWTAuth(), tags=["users"]
)
def list_my_friend_requests(request):
    user = request.auth
    friend_requests = Friendship.objects.filter(
        source=user, status=Friendship.FriendshipStatus.PENDING_RECEIVED
    ).select_related("target")
    # Performance: This might re-fetch target for each request?
    return [user_summary(f.target) for f in friend_requests]


@users_router.get("/{username}", response=UserDetail, tags=["users"])
def get_user_profile(request, username: str):
    viewer = get_optional_user(request)
    user = get_object_or_404(User, username=username)
    return user_detail_for_viewer(user, viewer)


# TODO: GET /{username}/relationship, with details on how the user is related to viewer
# Friendship status, mutual collectives, mutual friends, etc.


@users_router.post(
    "/{username}/friendship",
    response=MessageOut,
    auth=JWTAuth(),
    tags=["users"],
    description="Request to add a user as a friend, or accept a friend request from a user.",
)
def add_friend(request, username: str):
    source = request.auth
    target = get_object_or_404(User, username=username)

    if source == target:
        raise HttpError(400, "You cannot add yourself as a friend.")

    source_to_target = Friendship.objects.filter(source=source, target=target).first()

    if source_to_target is None:
        # Create a PENDING_SENT source->target and PENDING_RECEIVED target->source friendships
        with transaction.atomic():
            Friendship.objects.create(
                source=source,
                target=target,
                status=Friendship.FriendshipStatus.PENDING_SENT,
            )
            Friendship.objects.create(
                source=target,
                target=source,
                status=Friendship.FriendshipStatus.PENDING_RECEIVED,
            )
        # TODO: Send notification to target
        return MessageOut(message="Friend request sent.")

    # Handle existing frienship cases.
    if source_to_target.status == Friendship.FriendshipStatus.ACTIVE:
        raise HttpError(400, "You're already friends!")
    if source_to_target.status == Friendship.FriendshipStatus.PENDING_SENT:
        raise HttpError(400, "You've already sent a friend request to this user.")

    # Accept PENDING_RECEIVED request

    assert source_to_target.status == Friendship.FriendshipStatus.PENDING_RECEIVED

    target_to_source = Friendship.objects.filter(source=target, target=source).first()
    assert (
        target_to_source is not None
        and target_to_source.status == Friendship.FriendshipStatus.PENDING_SENT
    )

    # Update both friendships to be ACTIVE
    with transaction.atomic():
        target_to_source.status = Friendship.FriendshipStatus.ACTIVE
        target_to_source.save()
        source_to_target.status = Friendship.FriendshipStatus.ACTIVE
        source_to_target.save()

    # TODO: Send notification to target
    return MessageOut(message="Friend request accepted.")


@users_router.delete(
    "/{username}/friendship",
    response=MessageOut,
    auth=JWTAuth(),
    tags=["users"],
    description="Remove a user as a friend.",
)
def remove_friend(request, username: str):
    source = request.auth
    target = get_object_or_404(User, username=username)

    # Remove both source->target and target->source friendships.
    # Delete() returns a tuple of (number of rows deleted, row deletion details)
    # See: https://docs.djangoproject.com/en/6.0/topics/db/queries/#deleting-objects
    with transaction.atomic():
        source_deleted, _ = Friendship.objects.filter(
            source=source, target=target
        ).delete()

        target_deleted, _ = Friendship.objects.filter(
            source=target, target=source
        ).delete()

    if source_deleted == 0 and target_deleted == 0:
        return MessageOut(message="Friend not found.")

    return MessageOut(message="Friend removed.")
