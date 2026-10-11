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
                "Access-Control-Request-Headers": "Content-Type, X-API-Key, X-Tenant-Id",
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
