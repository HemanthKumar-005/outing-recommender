"""
Simulates an import pipeline for places data.
In a real production environment, this would ingest from Google Places API or OpenStreetMap.
"""
import argparse
import sys
import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "places_catalog.yaml"

def generate_mock_places(city: str, state: str, count: int) -> list:
    categories = [
        ("cafe", "cafe", 500),
        ("restaurant", "dining", 1200),
        ("park", "garden", 0),
        ("attraction", "monument", 100),
        ("bar", "brewery", 1500)
    ]
    
    mock_places = []
    for i in range(count):
        cat, subcat, cost = categories[i % len(categories)]
        mock_places.append({
            "name": f"{city} {subcat.capitalize()} {i+1}",
            "city": city,
            "state": state,
            "category": cat,
            "subcategory": subcat,
            "lat": round(20.0 + (i * 0.01), 4),
            "lng": round(77.0 + (i * 0.01), 4),
            "price_range": (i % 3) + 1,
            "average_cost": cost,
            "indoor_outdoor": "indoor" if cat in ("cafe", "restaurant", "bar") else "outdoor",
            "ambience": ["casual", "trendy"] if cat in ("cafe", "restaurant", "bar") else ["outdoor", "scenic"],
            "tags": ["casual", "family"] if cat != "bar" else ["nightlife", "drinks"],
            "couple_friendly": True,
            "friends_friendly": True,
            "family_friendly": cat != "bar",
            "description": f"Generated place for {city} import."
        })
    return mock_places

def import_places(city: str, state: str, count: int):
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {"places": []}
        
    if "places" not in data or data["places"] is None:
        data["places"] = []
        
    new_places = generate_mock_places(city, state, count)
    data["places"].extend(new_places)
    
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(data, f, sort_keys=False, allow_unicode=True)
        
    print(f"Imported {len(new_places)} new places for {city}, {state} into catalog.")
    print("Run `python scripts/seed_data.py` to push to database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import places for a city")
    parser.add_argument("--city", type=str, required=True, help="City name")
    parser.add_argument("--state", type=str, required=True, help="State name")
    parser.add_argument("--count", type=int, default=10, help="Number of places to import")
    args = parser.parse_args()
    
    import_places(args.city, args.state, args.count)
