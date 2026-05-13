from enum import Enum

from ninja import Field, ModelSchema, Schema

from ..models import Collective, Friendship, Membership, Post, User

### Common


class MessageOut(Schema):
    message: str


### Summary Schemas, for use in e.g. lists.


class UserSummary(ModelSchema):
    friendship_status: Friendship.FriendshipStatus | None = None

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name"]
        # Future: relationship summary, e.g. 'friend of friend'


class CollectiveSummary(ModelSchema):
    membership_status: Membership.Status | None = None
    membership_role: Membership.Role | None = None

    class Meta:
        model = Collective
        fields = ["slug", "name", "description", "visibility", "admission_type"]
        # Future: num_members


class MembershipSummary(Schema):
    user: UserSummary
    collective: CollectiveSummary
    status: Membership.Status
    role: Membership.Role


class PostSharingSummary(ModelSchema):
    class Meta:
        model = Post
        fields = [
            "public",
            "share_with_new_collectives_default",
            "share_with_new_friends_default",
        ]


class PostSummary(ModelSchema):
    owner: UserSummary

    # Only populated for a user's own posts
    sharing: PostSharingSummary | None = None

    class Meta:
        model = Post
        fields = ["slug", "type", "title"]


### Detail Schemas, for display of a single entity.


class PostSharingDetail(ModelSchema):
    shared_collectives: list[CollectiveSummary]
    shared_friends: list[UserSummary]

    class Meta:
        model = Post
        fields = [
            "public",
            "share_with_new_collectives_default",
            "share_with_new_friends_default",
        ]


class PostDetail(ModelSchema):
    owner: UserSummary

    # Only populated for a user's own posts
    sharing: PostSharingDetail | None = None

    class Meta:
        model = Post
        fields = [
            "slug",
            "created_at",
            "updated_at",
            "type",
            "title",
            "description",
        ]


class UserDetail(Schema):
    summary: UserSummary
    bio: str | None = None
    friendship_status: Friendship.FriendshipStatus | None = None

    # List of collectives in common with the viewer.
    mutual_collectives: list[CollectiveSummary]
    # List of friends in common with the viewer.
    mutual_friends: list[UserSummary]
    posts_shared_with_me: list[PostSummary]
    # Future: location, relation to viewer, mutuals


class CollectiveDetail(Schema):
    summary: CollectiveSummary
    members: list[MembershipSummary]
    application_question: str

    # Posts shared with the collective from all users.
    shared_posts: list[PostSummary]
    # Future: location, viewer's friends in group


class MembershipDetail(Schema):
    summary: MembershipSummary

    # Posts shared through this membership
    shared_posts: list[PostSummary] | None = None

    # Fields may be dropped depending on the user's role.
    application_message: str | None = None
    applied_at: str | None = None
    joined_at: str | None = None  # Missing for PENDING users
    updated_at: str | None = None
    approved_by: UserSummary | None = None


### Auth


class RegisterIn(Schema):
    username: str = Field(..., min_length=3, max_length=31)
    password: str = Field(..., min_length=8)
    email: str = Field(..., min_length=1, max_length=254)
    first_name: str = Field("", max_length=150)
    last_name: str = Field("", max_length=150)


class LoginIn(Schema):
    identifier: str = Field(..., min_length=3, max_length=254)
    password: str


class RefreshIn(Schema):
    refresh: str


class TokenPairOut(Schema):
    access: str
    refresh: str


class AccessTokenOut(Schema):
    access: str


class PasswordResetRequestIn(Schema):
    email: str = Field(..., min_length=1, max_length=254)


class PasswordResetConfirmIn(Schema):
    uid: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class VerifyEmailRequestIn(Schema):
    email: str = Field(..., min_length=1, max_length=254)


class VerifyEmailConfirmIn(Schema):
    uid: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)


### User Profile


# A user's own profile, including private fields.
class UserProfile(ModelSchema):
    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "email_verified",
            "first_name",
            "last_name",
            "bio",
        ]


class UpdateProfileRequest(ModelSchema):
    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "bio"]
        optional = ["__all__"]


### Collective


# User-configurable data for a collective.
class CollectiveSettings(ModelSchema):
    class Meta:
        model = Collective
        fields = [
            "name",
            "description",
            "visibility",
            "admission_type",
            "application_question",
        ]
        optional = ["__all__"]


### Membership


class JoinCollectiveRequest(Schema):
    application_message: str = Field("", max_length=10_000)
    shared_post_slugs: list[str] = Field(
        [],
        description=("Posts to share with the collective."),
    )


class UpdateMembershipRequest(Schema):
    application_message: str | None = Field(
        None,
        max_length=10_000,
        description="Requesting user only.",
    )
    shared_post_slugs: list[str] | None = Field(
        None,
        description=("Requesting user only."),
    )
    status: Membership.Status | None = Field(
        None, description="Admin and moderators only."
    )
    role: Membership.Role | None = Field(None, description="Admin only.")


### Post


# User-configurable data.
class PostSettings(Schema):
    type: Post.PostType = Field(Post.PostType.OFFER)
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=10_000)

    public: bool
    share_with_new_collectives_default: bool
    shared_collective_slugs: list[str] | None = None
    share_with_new_friends_default: bool
    shared_friend_usernames: list[str] | None = None
