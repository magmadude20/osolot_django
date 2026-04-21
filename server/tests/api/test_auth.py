import json

from django.test import TestCase

from tests.base import TestUser


class TestUserTests(TestCase):
    def test_incorrect_password_raises_exception(self):
        alice = TestUser(username="alice", email="alice@example.com")
        with self.assertRaises(AssertionError):
            alice.login("wrong")

    def test_user_login(self):
        alice = TestUser(username="alice", email="alice@example.com")
        alice.login()


class AuthApiTests(TestCase):

    def test_login_returns_tokens(self):
        alice = TestUser(
            username="alice", email="alice@example.com", password="sic-semper"
        )
        # Typically, tests will use TestUser.login(), but here we're testing
        # what's going on under the hood.
        response = alice.send_request(
            "post",
            "/api/auth/login",
            data={"identifier": "alice", "password": "sic-semper"},
        )
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertIn("access", body)
        self.assertIn("refresh", body)

    def test_login_invalid_credentials_401(self):
        bob = TestUser(username="bob", email="bob@example.com")
        # Typically, tests will use TestUser.login(), but here we're testing
        # what's going on under the hood.
        response = bob.send_request(
            "post",
            "/api/auth/login",
            data={"identifier": "bob", "password": "WRONG-PASSWORD"},
        )
        self.assertEqual(response.status_code, 401)

    def test_me_requires_auth(self):
        bob = TestUser(username="bob", email="bob@example.com")
        # Skip logging in
        response = bob.send_request("get", "/api/users/my/profile")
        self.assertEqual(response.status_code, 401)

    def test_me_returns_profile_when_authenticated(self):
        alice = TestUser(
            username="alice", first_name="Alice", email="alice@example.com"
        )
        alice.login()
        response = alice.client.get("/api/users/my/profile")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertEqual(body["username"], "alice")
        self.assertEqual(body["email"], "alice@example.com")
        self.assertEqual(body["first_name"], "Alice")
        self.assertIn("email_verified", body)
