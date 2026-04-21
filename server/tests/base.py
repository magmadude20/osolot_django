"""Shared helpers for API tests."""

from __future__ import annotations

import json
from typing import Any

from django.contrib.auth import get_user_model
from django.test import Client

from osolot_server.models import Collective

User = get_user_model()


class TestUser:
    def __init__(
        self,
        username: str,
        email: str,
        first_name: str | None = "",
        last_name: str | None = "",
        password: str = "password",
        email_verified: bool = True,
    ):
        self.user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email_verified=email_verified,
        )
        self.client = Client()

    def send_request(self, method: str, path: str, data: Any = None):
        kw: dict = {}
        if data is not None:
            kw["content_type"] = "application/json"
            kw["data"] = json.dumps(data)
        fn = getattr(self.client, method.lower())
        return fn(path, **kw)

    def login(self, password: str = "password"):
        response = self.send_request(
            "post",
            "/api/auth/login",
            data={"identifier": self.user.username, "password": password},
        )
        if response.status_code != 200:
            raise AssertionError(f"Failed to login")
        self.tokens = json.loads(response.content)
        self.client = Client(
            headers={"Authorization": f"Bearer {self.tokens['access']}"}
        )

    @staticmethod
    def collective_payload(**overrides: Any) -> dict[str, Any]:
        base: dict[str, Any] = {
            "name": "Test Collective",
            "description": "Description for tests.",
            "visibility": Collective.Visibility.PUBLIC,
            "admission_type": Collective.AdmissionType.OPEN,
            "application_question": "",
        }
        base.update(overrides)
        return base

    @staticmethod
    def _assert_response(response, raise_on_error: bool = True):
        if raise_on_error and response.status_code != 200:
            raise AssertionError(
                f"Failed to {response.status_code}: {response.content}"
            )
        return response

    def create_collective(self, raise_on_error: bool = True, **overrides: Any):
        return self._assert_response(
            self.send_request(
                "post", "/api/collectives/", data=self.collective_payload(**overrides)
            ),
            raise_on_error,
        )

    def update_collective(
        self, slug: str, raise_on_error: bool = True, **overrides: Any
    ):
        return self._assert_response(
            self.send_request(
                "put",
                f"/api/collectives/{slug}",
                data=self.collective_payload(**overrides),
            ),
            raise_on_error,
        )

    def list_collectives(self, raise_on_error: bool = True):
        return self._assert_response(
            self.send_request("get", "/api/collectives/"),
            raise_on_error,
        )

    def get_collective(self, slug: str, raise_on_error: bool = True):
        return (
            self._assert_response(self.send_request("get", f"/api/collectives/{slug}")),
            raise_on_error,
        )

    def join_collective(
        self, slug: str, application_message: str = "", raise_on_error: bool = True
    ):
        return self._assert_response(
            self.send_request(
                "post",
                f"/api/collectives/{slug}/join",
                data={"application_message": application_message},
            ),
            raise_on_error,
        )

    def list_collective_members(self, slug: str, raise_on_error: bool = True):
        return self._assert_response(
            self.send_request("get", f"/api/collectives/{slug}/members"),
            raise_on_error,
        )

    def get_membership(self, slug: str, username: str, raise_on_error: bool = True):
        return self._assert_response(
            self.send_request("get", f"/api/collectives/{slug}/membership/{username}"),
            raise_on_error,
        )

    def update_membership(
        self,
        slug: str,
        username: str,
        data: dict[str, Any],
        raise_on_error: bool = True,
    ):
        return self._assert_response(
            self.send_request(
                "put",
                f"/api/collectives/{slug}/membership/{username}",
                data=data,
            ),
            raise_on_error,
        )

    def leave_collective(
        self, slug: str, username: str | None = None, raise_on_error: bool = True
    ):
        who = username or self.user.username
        return self._assert_response(
            self.client.delete(f"/api/collectives/{slug}/membership/{who}"),
            raise_on_error,
        )

    def __str__(self) -> str:
        return self.user.username
