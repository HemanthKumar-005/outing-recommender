import sys
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db, geo

try:
    from shared.logging_config import configure_logging
    from shared.request_id_middleware import RequestIdMiddleware
    from shared.sentry_config import init_sentry
except ImportError:
    from logging_config import configure_logging
    from request_id_middleware import RequestIdMiddleware
    from sentry_config import init_sentry

init_sentry("place-service")
logger = configure_logging("place-service")

# FUTURE: if Google Places photos are added, proxy them through
# GET /places/{place_id}/photo — never embed API keys in frontend URLs.

app = FastAPI(title="Place Catalog Service")
app.add_middleware(RequestIdMiddleware)


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
    hours_verified: bool = False
    data_source: str = "estimated"
    verified_at: str | None = None
    verification_notes: str | None = None
    booking_url: str | None = None


class VenueReportCreate(BaseModel):
    issue_type: str = Field(..., pattern="^(wrong_hours|wrong_price|closed_permanently|wrong_location|other)$")
    description: str | None = Field(None, max_length=280)


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


@app.post("/places/{place_id}/report", status_code=201)
def report_place(
    place_id: int,
    payload: VenueReportCreate,
    request: Request,
    tenant_id: str = Depends(require_tenant),
):
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Authentication required to report issues")

    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID in auth header")

    place = db.get_place(tenant_id, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="place not found")

    # Rate-limit to 5 reports per user per day in Postgres
    recent_count = db.get_user_report_count_today(tenant_id, user_id)
    if recent_count >= 5:
        raise HTTPException(status_code=429, detail="Daily report limit reached (5 per day). Try again tomorrow.")

    report = db.create_venue_report(
        tenant_id=tenant_id,
        place_id=place_id,
        user_id=user_id,
        issue_type=payload.issue_type,
        description=payload.description,
    )

    publish("place.reported", {"tenant_id": tenant_id, "place_id": place_id, "user_id": user_id, "report_id": report["id"]})

    return {"reported": True, "report_id": report["id"]}


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
        if open_now and not _is_open_now(place.get("opening_hours") or {}):
            continue
        place = {**place, "distance_km": round(dist, 3)}
        results.append(place)
    results.sort(key=lambda p: p["distance_km"])
    return results[:limit]


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
