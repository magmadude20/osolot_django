import json

from django.test import TestCase

class HealthTests(TestCase):
    def test_openapi_schema_returns_json(self):
        response = self.client.get("/api/openapi.json")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertIn("openapi", body)
        self.assertIn("paths", body)

    def test_list_collectives_endpoint_not_server_error(self):
        response = self.client.get("/api/collectives/")
        self.assertLess(response.status_code, 500)
