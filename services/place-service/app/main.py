import sys
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db, geo

app = FastAPI(title="Place Catalog Service")


class PlaceCreate(BaseModel):
    name: str
    category: str
    subcategory: str | None = None
    price_range: int = Field(2, ge=1, le=4)
    average_cost: float | None = None
    rating: float | None = Field(None, ge=0, le=5)
    review_count: int = 0
    lat: float
    lng: float
    indoor_outdoor: str = Field("indoor", pattern="^(indoor|outdoor|both)$")
    ambience: list[str] = []
    tags: list[str] = []
    description: str = ""
    family_friendly: bool = False
    couple_friendly: bool = False
    friends_friendly: bool = False
    opening_hours: dict = {}  # e.g. {"mon": ["09:00","22:00"], ...}


class SentimentUpdate(BaseModel):
    sentiment_score: float = Field(..., ge=0.0, le=1.0)


def _is_open_now(opening_hours: dict) -> bool:
    if not opening_hours:
        return True
    day_key = datetime.now().strftime("%a").lower()[:3]
    window = opening_hours.get(day_key)
    if not window or len(window) != 2:
        return True
    now = datetime.now().strftime("%H:%M")
    return window[0] <= now <= window[1]


@app.get("/health")
def health():
    return {"status": "ok", "service": "place-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.list_places(tenant_id, limit=1)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


@app.post("/places", status_code=201)
def create_place(payload: PlaceCreate, tenant_id: str = Depends(require_tenant)):
    place = db.create_place(tenant_id, payload.model_dump())
    publish("place.updated", {"tenant_id": tenant_id, "place_id": place["id"], "reason": "created"})
    return place


@app.get("/places/{place_id}")
def get_place(place_id: int, tenant_id: str = Depends(require_tenant)):
    place = db.get_place(tenant_id, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="place not found")
    return place


@app.patch("/places/{place_id}/sentiment")
def patch_sentiment(place_id: int, payload: SentimentUpdate, tenant_id: str = Depends(require_tenant)):
    place = db.update_sentiment(tenant_id, place_id, payload.sentiment_score)
    if not place:
        raise HTTPException(status_code=404, detail="place not found")
    publish("place.updated", {"tenant_id": tenant_id, "place_id": place_id, "reason": "sentiment_updated"})
    return place


@app.get("/places")
def list_places(category: str | None = None, min_price: int | None = None, max_price: int | None = None,
                 tenant_id: str = Depends(require_tenant)):
    return db.list_places(tenant_id, category=category, min_price=min_price, max_price=max_price)


@app.get("/places/nearby")
def nearby(
    lat: float,
    lng: float,
    radius_km: float = Query(5.0, gt=0, le=50),
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    open_now: bool = False,
    limit: int = 50,
    tenant_id: str = Depends(require_tenant),
):
    lat_r1, lat_r2, lng_r1, lng_r2 = geo.bounding_box(lat, lng, radius_km)
    candidates = db.list_places(
        tenant_id, category=category, min_price=min_price, max_price=max_price,
        lat_range=(lat_r1, lat_r2), lng_range=(lng_r1, lng_r2), limit=1000,
    )
    results = []
    for place in candidates:
        dist = geo.haversine_km(lat, lng, place["lat"], place["lng"])
        if dist > radius_km:
            continue
        if open_now and not _is_open_now(place["opening_hours"]):
            continue
        place = {**place, "distance_km": round(dist, 3)}
        results.append(place)
    results.sort(key=lambda p: p["distance_km"])
    return results[:limit]
