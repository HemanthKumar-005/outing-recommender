import os
import sys

import httpx

sys.path.insert(0, "/shared")
from tenant import tenant_headers  # noqa: E402

USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://user-service:8000")
PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")
CONTEXT_SERVICE_URL = os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000")
INTERACTION_SERVICE_URL = os.environ.get("INTERACTION_SERVICE_URL", "http://interaction-service:8000")

_client = httpx.Client(timeout=5.0)


def get_user(tenant_id: str, user_id: int) -> dict | None:
    resp = _client.get(f"{USER_SERVICE_URL}/users/{user_id}", headers=tenant_headers(tenant_id))
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_context(lat: float, lng: float, at: str | None = None) -> dict:
    # context-service is not tenant-scoped (weather is shared, not tenant data).
    params = {"lat": lat, "lng": lng}
    if at:
        params["at"] = at
    resp = _client.get(f"{CONTEXT_SERVICE_URL}/context", params=params)
    resp.raise_for_status()
    return resp.json()


def get_nearby_places(tenant_id: str, lat: float, lng: float, radius_km: float, category: str | None = None,
                       min_price: int | None = None, max_price: int | None = None,
                       open_now: bool = False, limit: int = 100) -> list:
    params = {"lat": lat, "lng": lng, "radius_km": radius_km, "open_now": open_now, "limit": limit}
    if category:
        params["category"] = category
    if min_price is not None:
        params["min_price"] = min_price
    if max_price is not None:
        params["max_price"] = max_price
    resp = _client.get(f"{PLACE_SERVICE_URL}/places/nearby", params=params, headers=tenant_headers(tenant_id))
    resp.raise_for_status()
    return resp.json()


def get_all_interactions(tenant_id: str, limit: int = 5000) -> list:
    resp = _client.get(
        f"{INTERACTION_SERVICE_URL}/interactions", params={"limit": limit}, headers=tenant_headers(tenant_id),
    )
    resp.raise_for_status()
    return resp.json()


def get_user_interactions(tenant_id: str, user_id: int) -> list:
    resp = _client.get(
        f"{INTERACTION_SERVICE_URL}/users/{user_id}/interactions", headers=tenant_headers(tenant_id),
    )
    resp.raise_for_status()
    return resp.json()
