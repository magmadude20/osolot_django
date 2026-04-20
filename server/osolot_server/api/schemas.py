from ninja import Field, ModelSchema, Schema

from ..models import Collective, Membership, User

### Common


class MessageOut(Schema):
    message: str


### Summary Schemas, for use in e.g. lists.


class UserSummary(ModelSchema):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]
        # Future: relationship summary, e.g. 'friend of friend'


class CollectiveSummary(ModelSchema):
    class Meta:
        model = Collective
        fields = ["slug", "name", "description", "visibility", "admission_type"]
        # Future: num_members


class MembershipSummary(Schema):
    user: UserSummary
    collective: CollectiveSummary
    status: Membership.Status
    role: Membership.Role


### Detail Schemas, for display of a single entity.


class UserDetail(Schema):
    summary: UserSummary
    bio: str | None = None
    memberships: list[MembershipSummary]
    # Future: location, relation to viewer, mutuals


class CollectiveDetail(Schema):
    summary: CollectiveSummary
    members: list[MembershipSummary]
    application_question: str
    # Future: location, viewer's friends in group


class MembershipDetail(Schema):
    summary: MembershipSummary

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
            "id",
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


class UpdateMembershipRequest(Schema):
    application_message: str | None = Field(
        None,
        max_length=10_000,
        description="Requesting user only.",
    )
    status: Membership.Status | None = Field(
        None, description="Admin and moderators only."
    )
    role: Membership.Role | None = Field(None, description="Admin only.")
