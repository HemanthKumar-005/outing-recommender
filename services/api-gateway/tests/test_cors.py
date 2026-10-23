"""
Unit test for API Gateway CORS preflight handling.
Verifies that OPTIONS requests from http://localhost:3000 return proper CORS headers.
"""
import sys
import unittest
from pathlib import Path
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
GATEWAY_DIR = ROOT / "services" / "api-gateway"

for p in (str(SHARED_DIR), str(GATEWAY_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from app.main import app  # noqa: E402


class TestGatewayCORS(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_options_preflight_localhost_3000(self):
        res = self.client.options(
            "/api/recommendations/recommendations",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
<<<<<<< HEAD
                "Access-Control-Request-Headers": "Content-Type, X-API-Key",
=======
                "Access-Control-Request-Headers": "Content-Type, X-API-Key, X-Tenant-Id",
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://localhost:3000")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")
        # Check that requested headers are permitted
        allow_headers = res.headers.get("access-control-allow-headers", "")
        self.assertTrue(
            "*" in allow_headers or ("x-api-key" in allow_headers.lower() and "content-type" in allow_headers.lower())
        )

    def test_options_preflight_127_0_0_1_3000(self):
        res = self.client.options(
            "/api/places/search",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-API-Key",
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://127.0.0.1:3000")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")


if __name__ == "__main__":
    unittest.main()
<<<<<<< HEAD


class TestGatewayCORSStrictness(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_unknown_origin_not_allowed(self):
        res = self.client.options(
            "/api/recommendations/recommendations",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
        self.assertNotEqual(res.headers.get("access-control-allow-origin"), "https://evil.example")

    def test_identity_headers_are_not_client_settable(self):
        """Browsers must not be able to ask permission to send tenant/user identity headers."""
        res = self.client.options(
            "/api/users/users/me",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-Tenant-Id, X-User-Id",
            },
        )
        self.assertEqual(res.status_code, 400)
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
