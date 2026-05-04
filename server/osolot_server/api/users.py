from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from ..api_builders.detail_builders import user_detail_for_viewer
from ..api_builders.exceptions import validation_error_to_http_error
from ..api_builders.summary_builders import membership_summary
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
    return [UserSummary.from_orm(f.target) for f in friends]


@users_router.get(
    "/my/friend-requests", response=list[UserSummary], auth=JWTAuth(), tags=["users"]
)
def list_my_friend_requests(request):
    user = request.auth
    friend_requests = Friendship.objects.filter(
        target=user, status=Friendship.FriendshipStatus.REQUESTED
    ).select_related("source")
    return [UserSummary.from_orm(f.source) for f in friend_requests]


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

    existing_friendship = Friendship.objects.filter(
        source=source, target=target
    ).first()
    if existing_friendship is not None:
        if existing_friendship.status == Friendship.FriendshipStatus.REQUESTED:
            raise HttpError(400, "You've already sent a friend request to this user.")
        # Status is ACTIVE
        raise HttpError(400, "You're already friends!")

    # If `target` has a PENDING request, accept it.
    target_request = Friendship.objects.filter(source=target, target=source).first()
    if target_request is not None:
        # 1. Update the target->source friendship to ACTIVE
        # 2. Create an ACTIVE source->target friendship
        with transaction.atomic():
            target_request.status = Friendship.FriendshipStatus.ACTIVE
            target_request.save()
            Friendship.objects.create(
                source=source, target=target, status=Friendship.FriendshipStatus.ACTIVE
            )
        # TODO: Send notification to target
        return MessageOut(message="Friend request accepted.")
    else:
        # Create a PENDING source->target friendship
        Friendship.objects.create(
            source=source, target=target, status=Friendship.FriendshipStatus.REQUESTED
        )
        # TODO: Send notification to target
        return MessageOut(message="Friend request sent.")


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
        source_deleted_count, _ = Friendship.objects.filter(
            source=source, target=target
        ).delete()

        target_deleted_count, _ = Friendship.objects.filter(
            source=target, target=source
        ).delete()

    if source_deleted_count == 0 and target_deleted_count == 0:
        return MessageOut(message="Friend not found.")

    if target_deleted_count == 0:
        return MessageOut(message="Removed your friend request.")

    if source_deleted_count == 0:
        return MessageOut(message="Removed their friend request.")

    return MessageOut(message="Friend removed.")
