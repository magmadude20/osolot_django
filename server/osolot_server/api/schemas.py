from ninja import Field, Schema

### Common


class MessageOut(Schema):
    message: str


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


### User


class UserOut(Schema):
    id: int
    email: str
    email_verified: bool
    first_name: str
    last_name: str


class UserUpdateIn(Schema):
    first_name: str | None = Field(None, max_length=150)
    last_name: str | None = Field(None, max_length=150)
