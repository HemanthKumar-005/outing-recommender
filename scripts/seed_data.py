"""
Seeds sample users and places through the running API gateway.

Place catalog is loaded from data/places_catalog.yaml (no hard-coded
spot lists in this script). Users get preferred_occasions from config ids.

Usage:
    python3 scripts/seed_data.py
"""
from __future__ import annotations

import random
import sys
import time
from pathlib import Path

import requests
import yaml

BASE_URL = "http://localhost:8000/api"
API_KEY = "demo-key"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "places_catalog.yaml"
OCCASIONS_PATH = ROOT / "configs" / "occasions.yaml"

AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"]
OUTING_TYPES = ["couple", "friends", "family", "solo"]


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def occasion_ids() -> list[str]:
    cfg = load_yaml(OCCASIONS_PATH)
    return [o["id"] for o in cfg.get("occasions", []) if "id" in o]


def seed_users(n: int = 8) -> list[int]:
    ids = []
    occ = occasion_ids() or ["casual"]
    durations = [d["id"] for d in load_yaml(OCCASIONS_PATH).get("durations", [])] or [
        "4-6 hours"
    ]
    for i in range(n):
        payload = {
            "name": f"Demo User {i + 1}",
            "email": f"demo.user{i + 1}@example.com",
            "age_group": random.choice(AGE_GROUPS),
            "budget_min": random.choice([0, 1]),
            "budget_max": random.choice([2, 3, 4]),
            "preferred_categories": random.sample(
                ["cafe", "restaurant", "bar", "park", "attraction", "museum"], k=3
            ),
            "ambience_preferences": random.sample(
                ["cozy", "lively", "quiet", "romantic", "outdoor"], k=2
            ),
            "preferred_distance_km": random.choice([5, 8, 10, 15, 25]),
            "preferred_outing_type": random.choice(OUTING_TYPES),
            "preferred_occasions": random.sample(occ, k=min(2, len(occ))),
            "preferred_duration": random.choice(durations),
            "home_lat": 28.6139 + random.uniform(-0.05, 0.05),
            "home_lng": 77.2090 + random.uniform(-0.05, 0.05),
        }
        resp = requests.post(f"{BASE_URL}/users/users", json=payload, headers=HEADERS)
        if resp.status_code >= 400:
            print(f"user seed warning: {resp.status_code} {resp.text[:200]}")
            continue
        ids.append(resp.json()["id"])
        print(f"created user {ids[-1]}")
    return ids


def seed_places_from_catalog() -> list[int]:
    catalog = load_yaml(CATALOG_PATH)
    places = catalog.get("places") or []
    ids = []
    for p in places:
        payload = {
            "name": p["name"],
            "category": p["category"],
            "subcategory": p.get("subcategory"),
            "price_range": p.get("price_range", 2),
            "average_cost": p.get("average_cost"),
            "rating": round(random.uniform(3.8, 4.9), 1),
            "review_count": random.randint(20, 800),
            "lat": p["lat"],
            "lng": p["lng"],
            "city": p.get("city"),
            "state": p.get("state"),
            "indoor_outdoor": p.get("indoor_outdoor", "indoor"),
            "ambience": p.get("ambience") or [],
            "tags": p.get("tags") or [],
            "description": p.get("description") or "",
            "family_friendly": p.get("family_friendly", False),
            "couple_friendly": p.get("couple_friendly", False),
            "friends_friendly": p.get("friends_friendly", False),
            "opening_hours": {},
        }
        resp = requests.post(f"{BASE_URL}/places/places", json=payload, headers=HEADERS)
        if resp.status_code >= 400:
            print(f"place seed warning: {resp.status_code} {resp.text[:200]}")
            continue
        ids.append(resp.json()["id"])
        print(f"created place {ids[-1]}: {payload['name']} ({payload['category']})")
    return ids


def seed_interactions(user_ids: list[int], place_ids: list[int], n: int = 60) -> None:
    if not user_ids or not place_ids:
        print("skip interactions — missing users or places")
        return
    types = ["view", "click", "save", "visit", "rating", "share", "skip"]
    for _ in range(n):
        payload = {
            "user_id": random.choice(user_ids),
            "place_id": random.choice(place_ids),
            "type": random.choice(types),
        }
        if payload["type"] == "rating":
            payload["rating"] = round(random.uniform(2.5, 5.0), 1)
        resp = requests.post(
            f"{BASE_URL}/interactions/interactions", json=payload, headers=HEADERS
        )
        if resp.status_code >= 400:
            print(f"interaction warning: {resp.status_code}")
    print(f"created up to {n} interactions")


if __name__ == "__main__":
    if not CATALOG_PATH.is_file():
        print(f"Missing catalog {CATALOG_PATH}", file=sys.stderr)
        sys.exit(1)
    print("Seeding users...")
    user_ids = seed_users()
    print("Seeding places from place catalog...")
    place_ids = seed_places_from_catalog()
    time.sleep(0.5)
    print("Seeding interactions...")
    seed_interactions(user_ids, place_ids)
    print("\nDone. Try surprise:")
    print(f"  curl -H 'X-API-Key: {API_KEY}' '{BASE_URL}/places/surprise?occasion=romantic'")
    print("Try generate-plan:")
    print(
        f"  curl -H 'X-API-Key: {API_KEY}' -H 'Content-Type: application/json' "
        f"-d '{{\"occasion\":\"brewery_tour\",\"duration\":\"4-6 hours\",\"budget\":\"medium\"}}' "
        f"{BASE_URL}/itinerary/generate-plan"
    )
