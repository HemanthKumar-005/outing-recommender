import os
import sys

import httpx

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import tenant_headers  # noqa: E402

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")
CONTEXT_SERVICE_URL = os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000")

_client = httpx.Client(timeout=5.0)


def get_context(lat: float, lng: float) -> dict:
    # context-service is not tenant-scoped (weather is shared, not tenant data).
    resp = _client.get(f"{CONTEXT_SERVICE_URL}/context", params={"lat": lat, "lng": lng})
    resp.raise_for_status()
    return resp.json()


def find_indoor_alternative(tenant_id: str, lat: float, lng: float, category: str, exclude_place_id: int) -> dict | None:
    resp = _client.get(
        f"{PLACE_SERVICE_URL}/places/nearby",
        params={"lat": lat, "lng": lng, "radius_km": 5, "category": category, "limit": 5},
        headers=tenant_headers(tenant_id),
    )
    resp.raise_for_status()
    for place in resp.json():
        if place["id"] != exclude_place_id and place.get("indoor_outdoor") in ("indoor", "both"):
            return place
    return None


def notify(tenant_id: str, user_id: int, title: str, body: str) -> None:
    publish("notification.send", {
        "tenant_id": tenant_id, "user_id": user_id, "title": title, "body": body, "channel": "push",
    })
