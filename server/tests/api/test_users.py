import json

from django.test import TestCase

from osolot_server.models import Collective

from tests.base import TestUser


class UsersApiTests(TestCase):
    def test_get_user_profile_unknown_404(self):
        r = self.client.get("/api/users/does-not-exist-user")
        self.assertEqual(r.status_code, 404)

    def test_get_user_profile_mutual_collectives(self):
        owner = TestUser(username="owner_vt", email="owner_vt@example.com")
        owner.login()
        created = owner.create_collective(
            name="Shared",
            description="x",
            visibility=Collective.Visibility.PUBLIC,
            admission_type=Collective.AdmissionType.OPEN,
        )
        self.assertEqual(created.status_code, 200)
        slug = json.loads(created.content)["summary"]["slug"]

        viewer_tu = TestUser(username="vieweru", email="vieweru@example.com")
        target_tu = TestUser(username="targetu", email="targetu@example.com")
        viewer_tu.login()
        self.assertEqual(viewer_tu.join_collective(slug).status_code, 200)
        target_tu.login()
        self.assertEqual(target_tu.join_collective(slug).status_code, 200)

        viewer_tu.login()
        r = viewer_tu.send_request("get", "/api/users/targetu")
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertEqual(body["summary"]["username"], "targetu")
        slugs = {x["slug"] for x in body["mutual_collectives"]}
        self.assertIn(slug, slugs)

    def test_anonymous_profile_mutual_collectives_empty_when_target_has_collectives(
        self,
    ):
        solo = TestUser(username="solo_prof", email="solo_prof@example.com")
        solo.login()
        created = solo.create_collective(name="Solo Coll", description="x")
        self.assertEqual(created.status_code, 200)

        r = self.client.get("/api/users/solo_prof")
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertEqual(body["mutual_collectives"], [])
