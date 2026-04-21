import json

from django.test import TestCase

from osolot_server.models import Collective
from tests.base import TestUser


class CollectivesApiTests(TestCase):
    def test_create_collective_requires_auth(self):
        r = self.client.post(
            "/api/collectives/",
            data=json.dumps(TestUser.collective_payload()),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 401)

    def test_create_collective_returns_slug_and_admin_member(self):
        owner = TestUser(username="owner1", email="owner1@example.com")
        owner.login()
        r = owner.create_collective(name="My Group")
        body = json.loads(r.content)
        self.assertIn("summary", body)
        self.assertTrue(body["summary"]["slug"])
        self.assertEqual(body["summary"]["name"], "My Group")
        self.assertEqual(len(body["members"]), 1)
        self.assertEqual(body["members"][0]["user"]["username"], "owner1")
        self.assertEqual(body["members"][0]["role"], "admin")
        self.assertEqual(body["members"][0]["status"], "active")

    def test_create_collective_rejects_unverified_email(self):
        u = TestUser(
            username="unverified",
            email="unverified@example.com",
            email_verified=False,
        )
        u.login()
        # u.create_collective() will throw an exception. Send a normal request to verify status code.
        response = u.send_request(
            "post", "/api/collectives/", data=TestUser.collective_payload()
        )
        self.assertEqual(response.status_code, 403)

    def test_unlisted_hidden_from_anonymous_and_non_member_bob(self):
        alice = TestUser(username="alice", email="alice@example.com")
        alice.login()
        pub = alice.create_collective(name="Public Org")
        public_slug = json.loads(pub.content)["summary"]["slug"]
        hidden = alice.create_collective(
            name="Unlisted Org",
            description="x",
            visibility=Collective.Visibility.UNLISTED,
        )
        unlisted_slug = json.loads(hidden.content)["summary"]["slug"]

        # Anonymous user
        anon = self.client.get("/api/collectives/")
        self.assertEqual(anon.status_code, 200)
        anon_slugs = {c["slug"] for c in json.loads(anon.content)}
        self.assertIn(public_slug, anon_slugs)
        self.assertNotIn(unlisted_slug, anon_slugs)

        bob = TestUser(username="bob0", email="bob0@example.com")
        bob.login()
        bob_r = bob.list_collectives()
        self.assertEqual(bob_r.status_code, 200)
        bob_slugs = {c["slug"] for c in json.loads(bob_r.content)}
        self.assertIn(public_slug, bob_slugs)
        self.assertNotIn(unlisted_slug, bob_slugs)

    def test_bob_sees_unlisted_after_joining_alice_collective(self):
        alice = TestUser(username="alice2", email="alice2@example.com")
        alice.login()
        created = alice.create_collective(
            name="Hidden",
            description="x",
            visibility=Collective.Visibility.UNLISTED,
        )
        self.assertEqual(created.status_code, 200)
        slug = json.loads(created.content)["summary"]["slug"]

        bob = TestUser(username="bob", email="bob@example.com")
        bob.login()
        join = bob.join_collective(slug)
        self.assertEqual(join.status_code, 200)

        r = bob.list_collectives()
        self.assertEqual(r.status_code, 200)
        slugs = {c["slug"] for c in json.loads(r.content)}
        self.assertIn(slug, slugs)

    def test_invalid_visibility_400(self):
        u = TestUser(username="visbad", email="visbad@example.com")
        u.login()
        r = u.create_collective(visibility="not-a-real-visibility")
        self.assertEqual(r.status_code, 400)

    def test_get_collective_unknown_slug_404(self):
        r = self.client.get("/api/collectives/NONEXISTANT/")
        self.assertEqual(r.status_code, 404)
