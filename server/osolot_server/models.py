from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # allow username to be blank
    username = models.CharField(max_length=150, unique=True, blank=True)

    # email is unique, and will be used as/instead of username. 
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    USERNAME_FIELD = "email"
    # Contains 'email' by default, but it should NOT contain USERNAME_FIELD, so set to empty.
    # Creating a superuser fails w/o username.
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return self.email
