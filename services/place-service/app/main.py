"""Place catalog service — CRUD + surprise sampling."""
from __future__ import annotations

import sys
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from config_loader import (  # noqa: E402
    default_search_radius_km,
    list_cities,
    list_occasions_public,
    list_states,
    occasion_by_id,
    resolve_city,
)
from tenant import require_tenant  # noqa: E402

from . import db

app = FastAPI(title="Place Service")


class PlaceCreate(BaseModel):
    name: str
    category: str
    subcategory: str | None = None
    price_range: int = 2
    average_cost: float | None = None
    rating: float | None = None
    review_count: int = 0
    lat: float
    lng: float
    city: str | None = None
    state: str | None = None
    indoor_outdoor: str = "indoor"
    ambience: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    description: str = ""
    family_friendly: bool = False
    couple_friendly: bool = False
    friends_friendly: bool = False
    opening_hours: dict[str, Any] = Field(default_factory=dict)


class SurpriseBody(BaseModel):
    keyword: str | None = None
    category: str | None = None
    occasion: str | None = None
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None
    exclude_ids: list[int] = Field(default_factory=list)


class SentimentUpdate(BaseModel):
    sentiment_score: float


@app.get("/health")
def health():
    return {"status": "ok", "service": "place-service"}



@app.get("/occasions")
def occasions():
    """Expose canonical occasion list from config (for clients)."""
    return {"occasions": list_occasions_public()}



@app.get("/locations")
def locations(state: str | None = None):
    """Pan-India state/city list for the location picker (config-driven)."""
    return {
        "states": list_states(),
        "cities": list_cities(state),
        "default_radius_km": default_search_radius_km(),
    }


@app.get("/locations/resolve")
def resolve_location(city: str, state: str | None = None):
    hit = resolve_city(city, state)
    if not hit:
        raise HTTPException(status_code=404, detail="city not found in location index")
    return hit


@app.get("/search")
def search_places(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    city: str | None = None,
    state: str | None = None,
    category: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    tenant_id: str = Depends(require_tenant),
):
    """Find places near a chosen location — no hard-coded recommendation set."""
    if city and (lat is None or lng is None):
        hit = resolve_city(city, state)
        if hit:
            lat = float(hit["lat"])
            lng = float(hit["lng"])
    if radius_km is None and lat is not None:
        radius_km = default_search_radius_km()
    rows = db.search_places(
        tenant_id,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        city=city,
        state=state,
        category=category,
        q=q,
        limit=limit,
    )
    return {"count": len(rows), "places": rows, "query": {
        "lat": lat, "lng": lng, "radius_km": radius_km,
        "city": city, "state": state, "category": category, "q": q,
    }}

@app.post("/places", status_code=201)
def create_place(payload: PlaceCreate, tenant_id: str = Depends(require_tenant)):
    row = db.create_place(tenant_id, payload.model_dump())
    try:
        from eventbus import publish
        publish("place.updated", {"tenant_id": tenant_id, "place_id": row["id"], "reason": "place_created"})
    except Exception as e:  # noqa: BLE001
        print(f"[place-service] failed to publish place.updated for place {row.get('id')}: {e}")
    return row


@app.get("/places")
def list_places(
    limit: int = Query(200, ge=1, le=1000),
    tenant_id: str = Depends(require_tenant),
):
    return db.list_places(tenant_id, limit)


@app.get("/places/{place_id}")
def get_place(place_id: int, tenant_id: str = Depends(require_tenant)):
    row = db.get_place(tenant_id, place_id)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    return row


@app.patch("/places/{place_id}/sentiment")
def update_place_sentiment(
    place_id: int,
    payload: SentimentUpdate,
    tenant_id: str = Depends(require_tenant),
):
    row = db.update_place_sentiment(tenant_id, place_id, payload.sentiment_score)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    return row



def _surprise_impl(
    tenant_id: str,
    *,
    category: str | None,
    keyword: str | None,
    occasion: str | None,
    lat: float | None,
    lng: float | None,
    radius_km: float | None,
    exclude_ids: list[int] | None,
) -> dict:
    occasion_tags = None
    if occasion:
        meta = occasion_by_id(occasion)
        if meta:
            occasion_tags = list(meta.get("preferred_tags") or [])

    row = db.surprise_place(
        tenant_id,
        category=category,
        keyword=keyword,
        occasion_tags=occasion_tags,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        exclude_ids=exclude_ids or None,
    )
    if not row:
        # Fallback: relax filters progressively
        row = db.surprise_place(tenant_id, category=category, keyword=keyword)
    if not row:
        row = db.surprise_place(tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="no places available")

    result = dict(row)
    result["surprise"] = True
    note_parts = []
    if keyword:
        note_parts.append(f'matched "{keyword}"')
    if occasion:
        note_parts.append(f"occasion={occasion}")
    if category:
        note_parts.append(f"category={category}")
    result["note"] = (
        "Surprise pick" + (f" ({', '.join(note_parts)})" if note_parts else "")
    )
    return result


@app.get("/surprise")
def surprise_get(
    category: str | None = None,
    keyword: str | None = None,
    occasion: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    tenant_id: str = Depends(require_tenant),
):
    return _surprise_impl(
        tenant_id,
        category=category,
        keyword=keyword,
        occasion=occasion,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        exclude_ids=None,
    )


@app.post("/surprise")
def surprise_post(body: SurpriseBody, tenant_id: str = Depends(require_tenant)):
    return _surprise_impl(
        tenant_id,
        category=body.category,
        keyword=body.keyword,
        occasion=body.occasion,
        lat=body.lat,
        lng=body.lng,
        radius_km=body.radius_km,
        exclude_ids=body.exclude_ids,
    )
