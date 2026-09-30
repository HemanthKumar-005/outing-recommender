"""
Seeds sample users and places through the running API gateway so you get a
working end-to-end demo immediately after `docker compose up`.

Usage:
    python3 scripts/seed_data.py
    (requires the `requests` package: pip install requests)
"""
import random
import time

import requests

BASE_URL = "http://localhost:8000/api"
API_KEY = "demo-key"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# Roughly downtown-Bengaluru-shaped coordinates for a plausible geo spread.
CENTER_LAT, CENTER_LNG = 12.9716, 77.5946

CATEGORIES = ["cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"]
AMBIENCES = ["cozy", "lively", "quiet", "romantic", "family", "trendy", "outdoor", "casual"]
OUTING_TYPES = ["couple", "friends", "family", "solo"]
AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"]
INDOOR_OUTDOOR_BY_CATEGORY = {
    "cafe": "indoor", "restaurant": "indoor", "bar": "indoor", "museum": "indoor",
    "park": "outdoor", "cinema": "indoor", "shopping": "indoor", "attraction": "both",
}

PLACE_NAMES = [
    "Blue Tokai", "Copper & Cloves", "The Reading Room", "Toit Brewpub", "Third Wave",
    "Cubbon Park Grounds", "MG Road Museum", "Indiranagar Social", "Glen's Bakehouse",
    "Skyline Rooftop", "Church Street Diner", "Lalbagh Greens", "The Old Vinyl Cafe",
    "Forum Mall Cinema", "Koramangala Tacos", "Whitefield Brewhouse", "HSR Art Gallery",
    "Jayanagar Sweets", "Commercial Street Bazaar", "Nandi Hills Lookout",
]


def rand_offset(km_range=8.0):
    deg = km_range / 111.0
    return random.uniform(-deg, deg)


def seed_users(n=8):
    ids = []
    for i in range(n):
        payload = {
            "name": f"Demo User {i + 1}",
            "email": f"demo.user{i + 1}@example.com",
            "age_group": random.choice(AGE_GROUPS),
            "budget_min": random.choice([0, 1]),
            "budget_max": random.choice([2, 3, 4]),
            "preferred_categories": random.sample(CATEGORIES, k=3),
            "ambience_preferences": random.sample(AMBIENCES, k=2),
            "preferred_distance_km": random.choice([5, 8, 10, 15]),
            "preferred_outing_type": random.choice(OUTING_TYPES),
            "home_lat": CENTER_LAT + rand_offset(),
            "home_lng": CENTER_LNG + rand_offset(),
        }
        resp = requests.post(f"{BASE_URL}/users/users", json=payload, headers=HEADERS)
        resp.raise_for_status()
        ids.append(resp.json()["id"])
        print(f"created user {resp.json()['id']}: {payload['name']}")
    return ids


def seed_places(n=20):
    ids = []
    for i in range(n):
        category = random.choice(CATEGORIES)
        payload = {
            "name": PLACE_NAMES[i % len(PLACE_NAMES)],
            "category": category,
            "price_range": random.randint(1, 4),
            "average_cost": random.randint(200, 3000),
            "rating": round(random.uniform(3.0, 5.0), 1),
            "review_count": random.randint(5, 500),
            "lat": CENTER_LAT + rand_offset(),
            "lng": CENTER_LNG + rand_offset(),
            "indoor_outdoor": INDOOR_OUTDOOR_BY_CATEGORY.get(category, "indoor"),
            "ambience": random.sample(AMBIENCES, k=2),
            "tags": random.sample(["wifi", "outdoor-seating", "live-music", "parking", "pet-friendly"], k=2),
            "description": f"A popular {category} spot in the neighbourhood.",
            "family_friendly": random.choice([True, False]),
            "couple_friendly": random.choice([True, False]),
            "friends_friendly": random.choice([True, False]),
            "opening_hours": {},
        }
        resp = requests.post(f"{BASE_URL}/places/places", json=payload, headers=HEADERS)
        resp.raise_for_status()
        ids.append(resp.json()["id"])
        print(f"created place {resp.json()['id']}: {payload['name']} ({payload['category']})")
    return ids


def seed_interactions(user_ids, place_ids, n=60):
    types = ["view", "click", "save", "visit", "rating", "share", "skip"]
    for _ in range(n):
        payload = {
            "user_id": random.choice(user_ids),
            "place_id": random.choice(place_ids),
            "type": random.choice(types),
        }
        if payload["type"] == "rating":
            payload["rating"] = round(random.uniform(2.5, 5.0), 1)
        resp = requests.post(f"{BASE_URL}/interactions/interactions", json=payload, headers=HEADERS)
        resp.raise_for_status()
    print(f"created {n} interactions")


if __name__ == "__main__":
    print("Seeding users...")
    user_ids = seed_users()
    print("Seeding places...")
    place_ids = seed_places()
    time.sleep(1)  # let sentiment-worker's place.updated consumer catch up
    print("Seeding interactions...")
    seed_interactions(user_ids, place_ids)
    print("\nDone. Try:")
    print(f"  curl -H 'X-API-Key: {API_KEY}' "
          f"'{BASE_URL}/recommendations/recommendations' -X POST -H 'Content-Type: application/json' "
          f"-d '{{\"user_id\": {user_ids[0]}, \"lat\": {CENTER_LAT}, \"lng\": {CENTER_LNG}, \"radius_km\": 8}}'")
