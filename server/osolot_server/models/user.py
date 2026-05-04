from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models


class User(AbstractUser):
    REQUIRED_FIELDS = ["email"]

    username_validator = RegexValidator(
        regex=r"^[\w.-]{3,31}\Z",
        message="Username must be 3 to 31 characters: letters, digits, or _.-",
    )

    username = models.CharField(
        "username",
        max_length=150,
        unique=True,
        help_text="Required. 150 characters or fewer. Letters, digits, and _.- only.",
        validators=[username_validator],
        error_messages={
            "unique": "A user with that username already exists.",
        },
    )

    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)

    bio = models.TextField(blank=True, default="", max_length=10_000)

    friends = models.ManyToManyField(
        "self", through="Friendship", symmetrical=False
    )

    class Meta:
        # Security note: To prevent edge cases, add a database-level check that emails
        # always contain '@' and usernames never contain '@'. This guarantees that there
        # can never by any overlap between the two. This is mostly helpful during login,
        # where a user may enter either their username or email. The 'bad' scenario
        # would be Eve setting their username to Alice's email address, then being able
        # to login as Alice.
        #
        # The username and email validators SHOULD already catch this, but django doesn't
        # run validators during some operations (e.g. bulk updates). We _could_ make super
        # sure that we never do those type of operations, but we could also just add this
        # constraint and not rely on our remembering sneaky edge cases.
        constraints = [
            models.CheckConstraint(
                check=models.Q(email__contains="@"),
                name="valid_email_must_contain_at",
            ),
            models.CheckConstraint(
                # Note: `~models.Q()` negates the condition, so this is NOT(contains(@)).
                check=~models.Q(username__contains="@"),
                name="valid_username_must_not_contain_at",
            ),
        ]

    # Override save() to run username/email validation before saving.
    def save(self, **kwargs):
        self.full_clean()
        super().save(**kwargs)

    def __str__(self) -> str:
        return f"{self.username}[{self.id}]"
