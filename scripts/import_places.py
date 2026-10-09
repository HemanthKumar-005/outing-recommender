"""
Pipeline tool for ingesting and augmenting places data in data/places_catalog.yaml.
Supports importing for a single city, all configured cities across India,
or topping up cities to ensure minimum coverage for recommendations and itineraries.
"""
from __future__ import annotations

import argparse
import random
import sys
from collections import Counter
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "places_catalog.yaml"
LOCATIONS_PATH = ROOT / "configs" / "india_locations.yaml"

sys.path.insert(0, str(ROOT / "shared"))
try:
    # pyrefly: ignore [missing-import]
    from config_loader import resolve_city
except ImportError:
    resolve_city = None


def load_catalog() -> dict:
    if not CATALOG_PATH.is_file():
        return {"places": []}
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if "places" not in data or data["places"] is None:
        data["places"] = []
    return data


def save_catalog(data: dict):
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(data, f, sort_keys=False, allow_unicode=True)


def print_stats():
    data = load_catalog()
    places = data.get("places") or []
    counts = Counter(p.get("city") for p in places if p.get("city"))
    states = set(p.get("state") for p in places if p.get("state"))
    print("\n--- Place Catalog Summary ---")
    print(f"Total places: {len(places)}")
    print(f"Cities covered: {len(counts)}")
    print(f"States covered: {len(states)}")
    dist = Counter(counts.values())
    print(f"Places per city distribution: {dict(sorted(dist.items()))}")
    below_3 = [c for c, n in counts.items() if n < 3]
    if below_3:
        print(f"Cities with < 3 places ({len(below_3)}): {below_3}")
    else:
        print("All covered cities have 3 or more places.")
    print("-----------------------------\n")


def generate_mock_places(city: str, state: str, count: int, start_index: int = 1) -> list[dict]:
    categories = [
        ("cafe", "cafe", 500, "indoor", ["cozy", "trendy"], ["casual", "first_date_friendly", "wifi"], True, True, True),
        ("restaurant", "dining", 1200, "indoor", ["cozy", "romantic"], ["food", "casual", "family"], True, True, True),
        ("park", "garden", 50, "outdoor", ["outdoor", "quiet", "scenic"], ["nature", "scenic", "casual"], True, True, True),
        ("attraction", "monument", 100, "outdoor", ["heritage", "scenic"], ["heritage", "historic", "culture"], True, True, True),
        ("bar", "brewery", 1500, "indoor", ["lively", "trendy"], ["brewery", "craft_beer", "nightlife"], True, True, False),
    ]

    base_lat = 20.0
    base_lng = 77.0
    if resolve_city:
        resolved = resolve_city(city, state)
        if resolved and resolved.get("lat") and resolved.get("lng"):
            base_lat = float(resolved["lat"])
            base_lng = float(resolved["lng"])

    mock_places = []
    for i in range(count):
        idx = start_index + i
        cat, subcat, cost, in_out, amb, tags, couple_f, friends_f, family_f = categories[i % len(categories)]
        lat_offset = round(random.uniform(-0.03, 0.03), 4)
        lng_offset = round(random.uniform(-0.03, 0.03), 4)
        mock_places.append({
            "name": f"{city} {subcat.capitalize()} Spot {idx}",
            "city": city,
            "state": state,
            "category": cat,
            "subcategory": subcat,
            "lat": round(base_lat + lat_offset, 4),
            "lng": round(base_lng + lng_offset, 4),
            "price_range": (i % 3) + 1,
            "average_cost": cost,
            "indoor_outdoor": in_out,
            "ambience": list(amb),
            "tags": list(tags),
            "couple_friendly": couple_f,
            "friends_friendly": friends_f,
            "family_friendly": family_f,
            "description": f"Curated venue in {city} for outings, dates, and local discovery.",
        })
    return mock_places


def import_places(city: str, state: str, count: int):
    data = load_catalog()
    existing_in_city = sum(1 for p in data["places"] if p.get("city") == city)
    new_places = generate_mock_places(city, state, count, start_index=existing_in_city + 1)
    data["places"].extend(new_places)
    save_catalog(data)
    print(f"Imported {len(new_places)} new places for {city}, {state} into catalog.")
    print("Run `python scripts/seed_data.py` to push to database.")


def import_all_cities(count_per_city: int):
    if not LOCATIONS_PATH.is_file():
        print(f"Missing {LOCATIONS_PATH}", file=sys.stderr)
        return
    with open(LOCATIONS_PATH, "r", encoding="utf-8") as f:
        loc_data = yaml.safe_load(f) or {}

    data = load_catalog()
    total_added = 0
    for state_info in loc_data.get("states", []):
        state_name = state_info.get("name")
        for city_info in state_info.get("cities", []):
            city_name = city_info.get("name")
            existing = sum(1 for p in data["places"] if p.get("city") == city_name)
            new_places = generate_mock_places(city_name, state_name, count_per_city, start_index=existing + 1)
            data["places"].extend(new_places)
            total_added += len(new_places)

    save_catalog(data)
    print(f"Successfully added {total_added} places across all configured cities!")


def top_up_cities(min_count: int):
    if not LOCATIONS_PATH.is_file():
        print(f"Missing {LOCATIONS_PATH}", file=sys.stderr)
        return
    with open(LOCATIONS_PATH, "r", encoding="utf-8") as f:
        loc_data = yaml.safe_load(f) or {}

    data = load_catalog()
    total_added = 0
    for state_info in loc_data.get("states", []):
        state_name = state_info.get("name")
        for city_info in state_info.get("cities", []):
            city_name = city_info.get("name")
            existing = sum(1 for p in data["places"] if p.get("city") == city_name)
            needed = min_count - existing
            if needed > 0:
                new_places = generate_mock_places(city_name, state_name, needed, start_index=existing + 1)
                data["places"].extend(new_places)
                total_added += len(new_places)

    save_catalog(data)
    print(f"Topped up catalog to ensure at least {min_count} places per city (added {total_added} places).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import or manage places in places_catalog.yaml")
    parser.add_argument("--city", type=str, help="City name")
    parser.add_argument("--state", type=str, help="State name")
    parser.add_argument("--count", type=int, default=5, help="Number of places to import (default: 5)")
    parser.add_argument("--all-cities", action="store_true", help="Import places for all cities in config")
    parser.add_argument("--min-per-city", type=int, default=None, help="Top up any city with fewer than N places")
    parser.add_argument("--stats", action="store_true", help="Display catalog stats")
    args = parser.parse_args()

    if args.stats:
        print_stats()
    elif args.min_per_city is not None:
        top_up_cities(args.min_per_city)
        print_stats()
    elif args.all_cities:
        import_all_cities(args.count)
        print_stats()
    elif args.city and args.state:
        import_places(args.city, args.state, args.count)
        print_stats()
    else:
        print_stats()
        parser.print_help()
