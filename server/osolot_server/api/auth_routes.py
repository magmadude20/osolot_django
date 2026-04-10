import logging

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils.http import urlsafe_base64_decode
from ninja import Router
from ninja.errors import HttpError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from ..email.auth_emails import (
    send_password_reset_email,
    send_verification_email,
    token_generator,
)
from ..security import JWTAuth
from .schemas import (
    AccessTokenOut,
    VerifyEmailConfirmIn,
    VerifyEmailRequestIn,
    LoginIn,
    MessageOut,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    RefreshIn,
    RegisterIn,
    TokenPairOut,
)

logger = logging.getLogger(__name__)

User = get_user_model()

auth_router = Router()


# Register / login


@auth_router.post("/register", response=TokenPairOut, tags=["auth"])
def register(request, data: RegisterIn):
    email = (data.email or "").strip()
    if not email:
        raise HttpError(400, "Email is required.")
    if User.objects.filter(email__iexact=email).exists():
        raise HttpError(400, "An account with this email already exists.")
    try:
        user = User.objects.create_user(
            email,
            email=email,
            password=data.password,
            first_name=data.first_name or "",
            last_name=data.last_name or "",
        )
    except IntegrityError:
        raise HttpError(400, "Could not create user.") from None
    refresh = RefreshToken.for_user(user)
    return TokenPairOut(access=str(refresh.access_token), refresh=str(refresh))


@auth_router.post("/login", response=TokenPairOut, tags=["auth"])
def login(request, data: LoginIn):
    user = authenticate(request, email=data.email, password=data.password)
    if user is None:
        raise HttpError(401, "Invalid credentials.")
    if not user.is_active:
        raise HttpError(403, "User is inactive.")
    refresh = RefreshToken.for_user(user)
    return TokenPairOut(access=str(refresh.access_token), refresh=str(refresh))


@auth_router.post("/refresh", response=AccessTokenOut, tags=["auth"])
def refresh(request, data: RefreshIn):
    serializer = TokenRefreshSerializer(data={"refresh": data.refresh})
    if not serializer.is_valid():
        raise HttpError(401, "Invalid or expired refresh token.")
    access = serializer.validated_data["access"]
    return AccessTokenOut(access=access)


# Password reset


@auth_router.post(
    "/password-reset/request",
    response=MessageOut,
    tags=["auth"],
)
def password_reset_request(request, data: PasswordResetRequestIn):
    msg = "If an account exists for this email, we sent password reset instructions."
    email = (data.email or "").strip()
    if not email:
        return MessageOut(message=msg)
    user = User.objects.filter(email__iexact=email).first()
    if user is not None and user.is_active and user.email:
        try:
            send_password_reset_email(user)
        except Exception:
            logger.exception("password reset email failed")
    return MessageOut(message=msg)


@auth_router.post(
    "/password-reset/confirm",
    response=MessageOut,
    tags=["auth"],
)
def password_reset_confirm(request, data: PasswordResetConfirmIn):
    try:
        uid_bytes = urlsafe_base64_decode(data.uid)
        pk = int(uid_bytes.decode())
        user = User.objects.get(pk=pk)
    except (User.DoesNotExist, ValueError, UnicodeDecodeError, UnicodeError):
        raise HttpError(400, "Invalid or expired reset link.") from None
    if not token_generator.check_token(user, data.token):
        raise HttpError(400, "Invalid or expired reset link.")
    user.set_password(data.new_password)
    user.save()
    return MessageOut(message="Your password has been reset. You can log in now.")


# Email verification


@auth_router.post(
    "/verify-email/request",
    response=MessageOut,
    auth=JWTAuth(),
    tags=["auth"],
)
def email_verification_request(request, data: VerifyEmailRequestIn):
    user: User = request.auth
    if user is None:
        raise HttpError(401, "Invalid credentials.")
    if not user.is_active:
        raise HttpError(403, "User is inactive.")
    if user.email_verified:
        return MessageOut(message="Your email is already verified!")

    try:
        send_verification_email(user)
    except Exception:
        logger.exception("email verification send failed")
        return MessageOut(message="Failed to send verification email :(")

    return MessageOut(message="Verification email sent. Please check your inbox.")


@auth_router.post(
    "/verify-email/confirm",
    response=MessageOut,
    tags=["auth"],
)
def email_verification_confirm(request, data: VerifyEmailConfirmIn):
    try:
        uid_bytes = urlsafe_base64_decode(data.uid)
        pk = int(uid_bytes.decode())
        user = User.objects.get(pk=pk)
    except (User.DoesNotExist, ValueError, UnicodeDecodeError, UnicodeError):
        raise HttpError(400, "Invalid or expired verification link.") from None
    if not token_generator.check_token(user, data.token):
        raise HttpError(400, "Invalid or expired verification link.")
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    return MessageOut(message="Your email has been verified!")
