from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from ..api_builders.exceptions import validation_error_to_http_error
from ..api_builders.summary_builders import membership_summary
from ..api_builders.detail_builders import user_detail_for_viewer
from ..models import Membership
from ..security import JWTAuth, get_optional_user
from .schemas import (
    MembershipSummary,
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
    "/{username}", response=UserDetail, tags=["users"]
)
def get_user_profile(request, username: str):
    viewer = get_optional_user(request)
    user = get_object_or_404(User, username=username)
    return user_detail_for_viewer(user, viewer)
