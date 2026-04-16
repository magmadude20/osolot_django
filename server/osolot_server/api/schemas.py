from ninja import Field, Schema

### Common


class MessageOut(Schema):
    message: str


### Summary Schemas, for use in e.g. lists.


class UserSummary(Schema):
    id: int
    first_name: str
    last_name: str
    # Future: num_groups, mutuals


class CollectiveSummary(Schema):
    id: int
    name: str
    description: str
    visibility: str
    admission_type: str
    # Future: num_members, friends in group


class MembershipSummary(Schema):
    user: UserSummary
    collective: CollectiveSummary
    status: str
    role: str


### Detail Schemas, for display of a single entity.


class UserDetail(Schema):
    summary: UserSummary
    memberships: list[MembershipSummary]
    # Future: bio, relation, location


class CollectiveDetail(Schema):
    summary: CollectiveSummary
    members: list[MembershipSummary]
    application_question: str
    # Future: description, location


class MembershipDetail(Schema):
    summary: MembershipSummary
    application_message: str
    applied_at: str
    joined_at: str | None = None  # Missing for PENDING users
    updated_at: str
    approved_by: UserSummary | None = None


### Auth


class RegisterIn(Schema):
    password: str = Field(..., min_length=8)
    email: str = Field(..., min_length=1, max_length=254)
    first_name: str = Field("", max_length=150)
    last_name: str = Field("", max_length=150)


class LoginIn(Schema):
    email: str = Field(..., min_length=1, max_length=254)
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
class UserProfile(Schema):
    id: int
    email: str
    email_verified: bool
    first_name: str
    last_name: str


class UpdateProfileRequest(Schema):
    first_name: str | None = Field(None, max_length=150)
    last_name: str | None = Field(None, max_length=150)


### Collective


# User-configurable data for a collective.
class CollectiveSettings(Schema):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=100_000)
    visibility: str = Field("private", max_length=31)
    admission_type: str = Field("open", max_length=31)
    application_question: str = Field("", max_length=100_000)


### Membership


class JoinCollectiveRequest(Schema):
    application_message: str = Field("", max_length=100_000)


class UpdateMembershipRequest(Schema):
    # Only for user requesting to join collective.
    application_message: str | None = Field(None, max_length=100_000)
    # Only for admin and moderators.
    status: str | None = Field(None, max_length=31)
    # Only for admin.
    role: str | None = Field(None, max_length=31)
