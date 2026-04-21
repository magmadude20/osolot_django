import json

from django.test import TestCase

from osolot_server.models import Collective

from tests.base import TestUser


class MembershipsApiTests(TestCase):
    def _create_collective_via_api(
        self, owner_username: str, owner_email: str, **payload
    ) -> tuple[TestUser, str]:
        owner = TestUser(username=owner_username, email=owner_email)
        owner.login()
        r = owner.create_collective(
            name="Coll",
            description="D",
            **payload,
        )
        self.assertEqual(r.status_code, 200, r.content)
        data = json.loads(r.content)
        return owner, data["summary"]["slug"]

    def test_join_open_collective_becomes_active(self):
        _, slug = self._create_collective_via_api("adminj", "adminj@example.com")
        joiner = TestUser(username="joiner", email="joiner@example.com")
        joiner.login()
        r = joiner.join_collective(slug)
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertEqual(body["summary"]["status"], "active")

    def test_join_application_collective_is_pending(self):
        _, slug = self._create_collective_via_api(
            "admink",
            "admink@example.com",
            admission_type=Collective.AdmissionType.APPLICATION,
        )
        applicant = TestUser(username="applicant", email="applicant@example.com")
        applicant.login()
        r = applicant.join_collective(
            slug, application_message="Please let me in"
        )
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertEqual(body["summary"]["status"], "pending")

    def test_join_twice_returns_400(self):
        _, slug = self._create_collective_via_api("adminl", "adminl@example.com")
        twice = TestUser(username="twice", email="twice@example.com")
        twice.login()
        r1 = twice.join_collective(slug)
        self.assertEqual(r1.status_code, 200)
        r2 = twice.join_collective(slug)
        self.assertEqual(r2.status_code, 400)

    def test_member_can_leave_collective(self):
        _, slug = self._create_collective_via_api(
            "ownerleave", "ownerleave@example.com"
        )
        leaver = TestUser(username="leaver", email="leaver@example.com")
        leaver.login()
        join = leaver.join_collective(slug)
        self.assertEqual(join.status_code, 200)
        r = leaver.leave_collective(slug)
        self.assertEqual(r.status_code, 200)
        gone = leaver.get_membership(slug, "leaver")
        self.assertEqual(gone.status_code, 404)

    def test_non_member_cannot_remove_other_member(self):
        _, slug = self._create_collective_via_api("ownerm", "ownerm@example.com")
        insider = TestUser(username="insider", email="insider@example.com")
        outsider = TestUser(username="outsider", email="outsider@example.com")
        insider.login()
        insider.join_collective(slug)
        outsider.login()
        r = outsider.client.delete(
            f"/api/collectives/{slug}/membership/insider",
        )
        self.assertEqual(r.status_code, 403)

    def test_member_cannot_change_others_role(self):
        _, slug = self._create_collective_via_api("ownerr", "ownerr@example.com")
        peer = TestUser(username="peer", email="peer@example.com")
        peer.login()
        peer.join_collective(slug)
        r = peer.update_membership(
            slug, "ownerr", data={"role": "member"}
        )
        self.assertEqual(r.status_code, 403)

    def test_admin_can_approve_pending_member(self):
        admin, slug = self._create_collective_via_api(
            "adminp",
            "adminp@example.com",
            admission_type=Collective.AdmissionType.APPLICATION,
        )
        pend = TestUser(username="penduser", email="penduser@example.com")
        pend.login()
        pend.join_collective(slug, application_message="Hi")
        r = admin.update_membership(
            slug, "penduser", data={"status": "active"}
        )
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertEqual(body["summary"]["status"], "active")
        self.assertIsNotNone(body.get("joined_at"))
