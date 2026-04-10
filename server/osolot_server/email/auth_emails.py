import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

User = get_user_model()

logger = logging.getLogger(__name__)
token_generator = PasswordResetTokenGenerator()


# Same type of token is used for password resets and email verification.
# Email verification is harder to trigger, so there should be no
# additional attack surface vs only having password resets.
# I think the only risk would be social engineering, where folks could
# be prompted to share their verification link.
# PASSWORD_RESET_TIMEOUT is shortened to 1 hour to somewhat allieviate this.
# Eventually, it'll be easy to swap in a better implementation for
# email verification, but I don't want to spend time on it now.
def build_token_link(user, path: str) -> str:
    # Django's urlsafe_base64_encode returns str on Python 3 (not bytes).
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    base = settings.PASSWORD_RESET_FRONTEND_BASE_URL.rstrip("/")
    query = urlencode({"uid": uid, "token": token})
    return f"{base}/{path}?{query}"


def send_password_reset_email(user) -> None:
    if not user.email:
        return
    link = build_token_link(user, "reset-password")
    subject = "Osolot password reset"
    body = (
        f"Hi there,\n\n"
        "You asked to reset your Osolot password.\n\n"
        f"Open this link to choose a new password:\n{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def send_verification_email(user) -> None:
    if not user.email:
        return
    link = build_token_link(user, "verify-email")
    subject = "Osolot email verification"
    body = (
        f"Hi there,\n\n"
        f"Open this link to verify your email address:\n{link}\n\n"
        "Once you do, you'll be able to offer and request items."
    )
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
