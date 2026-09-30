import math
import sys
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

sys.path.insert(0, "/shared")
from eventbus import consume_in_background  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db, workers

app = FastAPI(title="Itinerary Service")

AVG_SPEED_KMH = 25.0  # rough city travel speed assumption
DEFAULT_VISIT_MINUTES = {
    "cafe": 45, "restaurant": 75, "bar": 90, "museum": 120, "park": 60,
    "cinema": 150, "shopping": 90, "attraction": 90,
}
FALLBACK_VISIT_MINUTES = 60


class PlaceStop(BaseModel):
    id: int
    name: str
    category: str
    lat: float
    lng: float
    indoor_outdoor: str = "indoor"


class ItineraryRequest(BaseModel):
    places: list[PlaceStop]
    start_time: str  # ISO datetime
    end_time: str  # ISO datetime
    user_id: int | None = None  # enables feedback reminders + weather-swap alerts


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _travel_minutes(km: float) -> float:
    return (km / AVG_SPEED_KMH) * 60.0


def _on_interaction_event(routing_key: str, payload: dict):
    if routing_key == "interactions" and payload.get("type") == "rating":
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            return
        updated = db.mark_rated(tenant_id, payload["user_id"], payload["place_id"])
        if updated:
            print(f"[itinerary-service] marked {updated} itinerary item(s) rated "
                  f"(tenant {tenant_id}, user {payload['user_id']}, place {payload['place_id']})")


@app.on_event("startup")
def startup():
    workers.start_background_workers()
    consume_in_background("itinerary-service.rating-updates", ["interactions"], _on_interaction_event)


@app.get("/health")
def health():
    return {"status": "ok", "service": "itinerary-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.get_itinerary(tenant_id, -1)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


@app.get("/itinerary/{itinerary_id}")
def get_itinerary(itinerary_id: int, tenant_id: str = Depends(require_tenant)):
    itinerary = db.get_itinerary(tenant_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found")
    return itinerary


@app.post("/itinerary")
def build_itinerary(req: ItineraryRequest, tenant_id: str = Depends(require_tenant)):
    try:
        start = datetime.fromisoformat(req.start_time)
        end = datetime.fromisoformat(req.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_time/end_time must be ISO datetimes")
    if end <= start:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    if not req.places:
        raise HTTPException(status_code=400, detail="places must not be empty")

    # Greedy nearest-neighbour ordering starting from the first place given.
    remaining = req.places.copy()
    ordered = [remaining.pop(0)]
    while remaining:
        last = ordered[-1]
        remaining.sort(key=lambda p: _haversine_km(last.lat, last.lng, p.lat, p.lng))
        ordered.append(remaining.pop(0))

    items = []
    current_time = start
    skipped = []
    for i, place in enumerate(ordered):
        if i > 0:
            prev = ordered[i - 1]
            travel_km = _haversine_km(prev.lat, prev.lng, place.lat, place.lng)
            current_time += timedelta(minutes=_travel_minutes(travel_km))
        else:
            travel_km = 0.0

        visit_minutes = DEFAULT_VISIT_MINUTES.get(place.category, FALLBACK_VISIT_MINUTES)
        stop_end = current_time + timedelta(minutes=visit_minutes)

        if stop_end > end:
            skipped.append(place.name)
            continue

        items.append({
            "place_id": place.id,
            "name": place.name,
            "category": place.category,
            "indoor_outdoor": place.indoor_outdoor,
            "lat": place.lat,
            "lng": place.lng,
            "arrival": current_time.isoformat(),
            "departure": stop_end.isoformat(),
            "visit_minutes": visit_minutes,
            "travel_km_from_previous": round(travel_km, 2),
        })
        current_time = stop_end

    saved = db.create_itinerary(tenant_id, req.user_id, start.isoformat(), end.isoformat(), items) if items else None

    return {
        "itinerary_id": saved["id"] if saved else None,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "itinerary": items,
        "skipped_no_time": skipped,
        "feedback_and_weather_alerts_enabled": req.user_id is not None,
    }
