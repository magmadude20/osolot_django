"""
Test settings: SQLite, DEBUG off, hosts for Django test client.

Use: python manage.py test tests --settings=config.settings_test
"""

from .settings import *  # noqa: F403

DEBUG = False

ALLOWED_HOSTS = list(
    dict.fromkeys(
        [*ALLOWED_HOSTS, "testserver", "localhost", "127.0.0.1"]
    )
)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# DO NOT COPY TO PRODUCTION
# This speeds up tests on my machine from >13 seconds to 0.2 seconds, which is wild.
PASSWORD_HASHERS = (
    'django.contrib.auth.hashers.MD5PasswordHasher',
)

# Debug toolbar is only appended when DEBUG; keep tests quiet.
INSTALLED_APPS = [a for a in INSTALLED_APPS if a != "debug_toolbar"]
MIDDLEWARE = [m for m in MIDDLEWARE if "debug_toolbar" not in m]
