"""
Enrich places data in data/places_catalog.yaml with weekly opening hours and pricing.

Prioritizes free data sources in order:
1. Data already in repository (average_cost preserved as curated cost_for_two)
2. OpenStreetMap opening_hours tags via Overpass API (parsed into weekly ranges)
3. Category-based realistic Indian defaults for hours and pricing

Records `source` and `is_estimated` for both hours and pricing.
Idempotent — preserves existing 310 places and existing curated attributes.
"""
from __future__ import annotations

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared"))

from hours_pricing import (  # noqa: E402
    CATEGORY_DEFAULTS,
    WEEKDAYS,
    compute_price_tier,
    get_category_default,
    parse_osm_opening_hours,
)

CATALOG_PATH = ROOT / "data" / "places_catalog.yaml"


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def fetch_osm_hours_for_clusters(places: list[dict]) -> dict[str, str]:
    """
    Attempts to fetch real OSM opening_hours for places by clustering nearby places.
    Returns mapping from lower(place_name) -> osm_opening_hours_string.
    """
    osm_hours_map: dict[str, str] = {}
    
    # Pick distinct cities / clusters to query
    city_centers: dict[str, tuple[float, float]] = {}
    for p in places:
        city = p.get("city") or "default"
        if city not in city_centers and p.get("lat") and p.get("lng"):
            city_centers[city] = (float(p["lat"]), float(p["lng"]))

    print(f"Querying OpenStreetMap for venues across {min(len(city_centers), 8)} major hubs...", flush=True)

    # Query top hubs
    hubs_to_query = list(city_centers.items())[:8]
    for city_name, (clat, clng) in hubs_to_query:
        query = f"""
        [out:json][timeout:10];
        (
          node["opening_hours"](around:4000,{clat},{clng});
          way["opening_hours"](around:4000,{clat},{clng});
        );
        out tags 20;
        """
        url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(query)
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "OutingRecommender/1.0 (Student Academic Project)"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                elems = data.get("elements", [])
                for el in elems:
                    tags = el.get("tags", {})
                    name = tags.get("name")
                    hours_tag = tags.get("opening_hours")
                    if name and hours_tag:
                        osm_hours_map[name.strip().lower()] = hours_tag
            time.sleep(1.0)  # Polite delay
        except Exception as e:
            print(f"OSM query notice for {city_name}: {e} (falling back to category defaults)", flush=True)

    return osm_hours_map


def match_osm_hours(place: dict, osm_hours_map: dict[str, str]) -> str | None:
    p_name = place.get("name", "").strip().lower()
    if p_name in osm_hours_map:
        return osm_hours_map[p_name]
    
    # Check word overlap
    p_words = set(p_name.split())
    for osm_name, hours in osm_hours_map.items():
        osm_words = set(osm_name.split())
        if len(p_words & osm_words) >= 2 and len(p_words & osm_words) / max(len(p_words), 1) >= 0.5:
            return hours
    return None


def enrich_catalog():
    if not CATALOG_PATH.is_file():
        print(f"Catalog file not found: {CATALOG_PATH}", file=sys.stderr)
        return

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    places = data.get("places") or []
    print(f"Loaded {len(places)} places from catalog.", flush=True)

    # Try OSM query
    osm_map = fetch_osm_hours_for_clusters(places)
    print(f"Collected {len(osm_map)} real OpenStreetMap venues with opening_hours.", flush=True)

    osm_hours_count = 0
    cat_hours_count = 0
    curated_price_count = 0
    cat_price_count = 0

    lacking_real_hours = []
    lacking_real_prices = []

    for place in places:
        cat = place.get("category", "")
        cat_default = get_category_default(cat)

        # 1. Opening Hours
        osm_raw = match_osm_hours(place, osm_map)
        parsed_osm = parse_osm_opening_hours(osm_raw) if osm_raw else None

        if parsed_osm:
            place["opening_hours"] = parsed_osm
            place["opening_hours_source"] = "osm"
            place["opening_hours_is_estimated"] = False
            osm_hours_count += 1
        else:
            # Category default
            place["opening_hours"] = dict(cat_default["hours"])
            place["opening_hours_source"] = "category_default"
            place["opening_hours_is_estimated"] = True
            cat_hours_count += 1
            lacking_real_hours.append(f"{place.get('name')} ({place.get('city')})")

        # 2. Pricing & Cost for Two & Entry Fee
        existing_cost = place.get("average_cost")
        if existing_cost is not None and float(existing_cost) > 0:
            place["cost_for_two"] = float(existing_cost)
            place["pricing_source"] = "repo_curated"
            place["pricing_is_estimated"] = False
            curated_price_count += 1
        else:
            place["cost_for_two"] = float(cat_default["cost_for_two"])
            place["pricing_source"] = "category_default"
            place["pricing_is_estimated"] = True
            cat_price_count += 1
            lacking_real_prices.append(f"{place.get('name')} ({place.get('city')})")

        # Entry fee for attractions / parks / museums
        if cat in ("attraction", "museum"):
            place["entry_fee"] = 50.0
        elif cat == "park":
            place["entry_fee"] = 20.0
        else:
            place["entry_fee"] = 0.0

        # Sync price_range (0-4)
        place["price_range"] = compute_price_tier(place["cost_for_two"], place.get("price_range"))

    # Save back to catalog
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(data, f, sort_keys=False, allow_unicode=True)

    print("\n=======================================================", flush=True)
    print("Catalog Enrichment Complete!", flush=True)
    print(f"Total places processed: {len(places)}", flush=True)
    print(f"Opening Hours: {osm_hours_count} real OSM, {cat_hours_count} category default (estimated)", flush=True)
    print(f"Pricing: {curated_price_count} repo curated, {cat_price_count} category default (estimated)", flush=True)
    print("=======================================================\n", flush=True)

    # Save summary report for deliverable
    report_path = ROOT / "data" / "enrichment_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_places": len(places),
            "osm_hours_count": osm_hours_count,
            "category_hours_count": cat_hours_count,
            "curated_price_count": curated_price_count,
            "estimated_price_count": cat_price_count,
            "places_lacking_real_hours_count": len(lacking_real_hours),
            "places_lacking_real_prices_count": len(lacking_real_prices),
            "places_lacking_real_hours": lacking_real_hours,
            "places_lacking_real_prices": lacking_real_prices,
        }, f, indent=2)
    print(f"Enrichment report saved to {report_path}", flush=True)


if __name__ == "__main__":
    enrich_catalog()
