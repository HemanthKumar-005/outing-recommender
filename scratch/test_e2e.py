import requests

BASE_URL = "http://localhost:8000/api"
HEADERS = {"X-API-Key": "demo-key", "Content-Type": "application/json"}

# 1. Recommend
print("1. Recommending...")
resp = requests.post(
    f"{BASE_URL}/recommendations/recommendations", 
    json={"lat": 28.6139, "lng": 77.2090, "radius_km": 25.0, "occasion": "romantic"},
    headers=HEADERS
)
print("Rec status:", resp.status_code)
if resp.status_code == 200:
    recs = resp.json().get("recommendations", [])
    print("Found places:", len(recs))
    place_ids = [r["place"]["id"] for r in recs[:3]]
    print("Place IDs:", place_ids)
    
    # 2. Generate plan
    print("\n2. Generating plan...")
    plan_resp = requests.post(
        f"{BASE_URL}/itinerary/generate-plan",
        json={"place_ids": place_ids, "occasion": "romantic"},
        headers=HEADERS
    )
    print("Plan status:", plan_resp.status_code)
    if plan_resp.status_code == 200:
        plan = plan_resp.json()
        print("Plan Title:", plan["data"]["title"])
        it_id = plan["data"].get("itinerary_id")
        
        # 3. Refine
        if it_id:
            print(f"\n3. Refining plan {it_id}...")
            ref_resp = requests.post(
                f"{BASE_URL}/itinerary/itineraries/{it_id}/refine",
                json={"feedback": "too expensive, make it cheaper"},
                headers=HEADERS
            )
            print("Refine status:", ref_resp.status_code)
            if ref_resp.status_code == 200:
                print("Refined Title:", ref_resp.json()["data"]["title"])
