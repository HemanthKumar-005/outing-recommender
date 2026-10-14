import os
import sys

import httpx

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import tenant_headers  # noqa: E402

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")
CONTEXT_SERVICE_URL = os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000")

LOCATIONIQ_API_KEY = os.environ.get("LOCATIONIQ_API_KEY", "")

_client = httpx.Client(timeout=6.0)


def fetch_road_directions(coordinates: list[tuple[float, float]]) -> dict | None:
    """
    Fetch urban road directions, distance matrix, and driving duration from LocationIQ (OSRM).
    coordinates: list of (lat, lng) points in sequential travel order.
    Returns parsed route summary or None on failure/missing key.
    """
    if not LOCATIONIQ_API_KEY or len(coordinates) < 2:
        return None
    try:
        # LocationIQ / OSRM expects: lon,lat;lon,lat;...
        coords_param = ";".join(f"{lng},{lat}" for lat, lng in coordinates)
        url = f"https://us1.locationiq.com/v1/directions/driving/{coords_param}"
        params = {
            "key": LOCATIONIQ_API_KEY,
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        }
        resp = _client.get(url, params=params, headers={"User-Agent": "OutingPlanner/1.0"})
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None

        route = data["routes"][0]
        legs = [
            {
                "distance_km": round(float(leg.get("distance", 0.0)) / 1000.0, 2),
                "duration_min": round(float(leg.get("duration", 0.0)) / 60.0, 1),
            }
            for leg in route.get("legs", [])
        ]
        return {
            "provider": "locationiq",
            "total_distance_km": round(float(route.get("distance", 0.0)) / 1000.0, 2),
            "total_duration_min": round(float(route.get("duration", 0.0)) / 60.0, 1),
            "legs": legs,
            "geometry": route.get("geometry", {}),
        }
    except Exception:
        return None


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

