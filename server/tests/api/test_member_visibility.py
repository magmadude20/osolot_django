import json

from django.test import TestCase

from osolot_server.models import Collective

from tests.base import TestUser


class CollectiveMemberVisibilityApiTests(TestCase):
    def test_authenticated_non_member_sees_empty_members_list(self):
        alice = TestUser(username="vis_alice", email="vis_alice@example.com")
        alice.login()
        created = alice.create_collective(name="C", description="d")
        self.assertEqual(created.status_code, 200)
        slug = json.loads(created.content)["summary"]["slug"]

        bob = TestUser(username="vis_bob", email="vis_bob@example.com")
        bob.login()
        r = bob.list_collective_members(slug)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(json.loads(r.content), [])

    def test_pending_applicant_members_list_is_only_their_row(self):
        owner = TestUser(username="pend_vis_owner", email="pend_vis_owner@ex.com")
        owner.login()
        created = owner.create_collective(
            name="C2",
            description="d",
            admission_type=Collective.AdmissionType.APPLICATION,
        )
        self.assertEqual(created.status_code, 200)
        slug = json.loads(created.content)["summary"]["slug"]

        pending = TestUser(
            username="pend_vis_app", email="pend_vis_app@example.com"
        )
        pending.login()
        self.assertEqual(
            pending.join_collective(slug, application_message="Hi").status_code,
            200,
        )

        r = pending.list_collective_members(slug)
        self.assertEqual(r.status_code, 200)
        rows = json.loads(r.content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["user"]["username"], "pend_vis_app")
