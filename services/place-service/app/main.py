"""Place catalog service — CRUD + surprise sampling."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break
from config_loader import (  # noqa: E402
    default_search_radius_km,
    list_cities,
    list_occasions_public,
    list_states,
    occasion_by_id,
    resolve_city,
)
from hours_pricing import evaluate_place_hours, format_price_display  # noqa: E402
from tenant import require_tenant  # noqa: E402
<<<<<<< HEAD
from authctx import Principal, get_principal  # noqa: E402
from observability import setup_observability  # noqa: E402
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

from . import db

app = FastAPI(title="Place Service")
<<<<<<< HEAD
setup_observability(app, "place-service")
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8


def _enrich_place(row: dict | None) -> dict | None:
    if not row:
        return None
    res = dict(row)
    hours_eval = evaluate_place_hours(res.get("opening_hours"))
    price_eval = format_price_display(
        res.get("cost_for_two") or res.get("average_cost"),
        res.get("price_range"),
        res.get("pricing_is_estimated", True),
        res.get("entry_fee", 0.0),
    )
    res.update(hours_eval)
<<<<<<< HEAD
    # Category-default hours are guesses (e.g. "every attraction closes Mondays 5:30 PM").
    # Never present a guess as fact: no "Open now"/"Closed" verdict, and a visible badge instead.
    res["hours_is_estimated"] = bool(res.get("opening_hours_is_estimated", True))
    if res["hours_is_estimated"]:
        res["open_now"] = None
        res["hours_status"] = "Hours not verified"
        res["hours_detail"] = "Estimated hours \u2014 verify ahead"
        res["closes_in_minutes"] = None
        res["opens_at"] = None
        if res.get("today_hours") and res["today_hours"] != "Hours unavailable":
            res["today_hours"] = "~" + res["today_hours"]
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    res.update(price_eval)
    return res


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
    opening_hours_source: str = "category_default"
    opening_hours_is_estimated: bool = True
    entry_fee: float = 0.0
    cost_for_two: float | None = None
    pricing_source: str = "category_default"
    pricing_is_estimated: bool = True
<<<<<<< HEAD
    source: str = "unknown"
    source_id: str | None = None
    verification_status: str = Field("unverified", pattern="^(unverified|verified|closed|rejected)$")


class IssueReportBody(BaseModel):
    issue_type: str = Field(pattern="^(closed|wrong_hours|wrong_price|wrong_location|does_not_exist|other)$")
    details: str = Field("", max_length=2000)


class ResolveBody(BaseModel):
    accept: bool


class VerificationBody(BaseModel):
    status: str = Field(pattern="^(unverified|verified|closed|rejected)$")
    source_id: str | None = None
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8


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
    ambience_add: list[str] | None = None


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
    open_now: bool | None = None,
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
    enriched = [_enrich_place(r) for r in rows if r]
    if open_now is True:
        enriched = [r for r in enriched if r.get("open_now") is True]
    elif open_now is False:
        enriched = [r for r in enriched if r.get("open_now") is False]
    return {"count": len(enriched), "places": enriched, "query": {
        "lat": lat, "lng": lng, "radius_km": radius_km,
        "city": city, "state": state, "category": category, "q": q,
        "open_now": open_now,
    }}

<<<<<<< HEAD
@app.get("/places/nearby")
def nearby_places(
    lat: float,
    lng: float,
    radius_km: float = Query(10.0, gt=0, le=200),
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    open_now: bool = False,
    limit: int = Query(50, ge=1, le=200),
    tenant_id: str = Depends(require_tenant),
):
    """Places around a point. (Clients in itinerary-service and recommendation-engine call this
    path; it previously did not exist, so the weather-watch indoor-alternative lookup always failed.)"""
    rows = db.search_places(tenant_id, lat=lat, lng=lng, radius_km=radius_km, category=category, limit=limit)
    out = [_enrich_place(r) for r in rows if r]
    if min_price is not None:
        out = [p for p in out if (p.get("price_range") or 0) >= min_price]
    if max_price is not None:
        out = [p for p in out if (p.get("price_range") or 0) <= max_price]
    if open_now:
        out = [p for p in out if p.get("open_now") is True]
    return out


@app.post("/places", status_code=201)
def create_place(payload: PlaceCreate, principal: Principal = Depends(get_principal)):
    # Catalog writes are an operator / tenant-level action, never an end-user one.
    if principal.user_id is not None and principal.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    tenant_id = principal.tenant_id
=======
@app.post("/places", status_code=201)
def create_place(payload: PlaceCreate, tenant_id: str = Depends(require_tenant)):
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    row = db.create_place(tenant_id, payload.model_dump())
    try:
        from eventbus import publish
        publish("place.updated", {"tenant_id": tenant_id, "place_id": row["id"], "reason": "place_created"})
    except Exception as e:  # noqa: BLE001
        print(f"[place-service] failed to publish place.updated for place {row.get('id')}: {e}")
    return _enrich_place(row)


@app.get("/places")
def list_places(
    limit: int = Query(200, ge=1, le=1000),
    tenant_id: str = Depends(require_tenant),
):
    return [_enrich_place(r) for r in db.list_places(tenant_id, limit) if r]


@app.get("/places/{place_id}")
def get_place(place_id: int, tenant_id: str = Depends(require_tenant)):
    row = db.get_place(tenant_id, place_id)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    return _enrich_place(row)


<<<<<<< HEAD
@app.post("/places/{place_id}/report", status_code=201)
def report_issue(place_id: int, payload: IssueReportBody, principal: Principal = Depends(get_principal)):
    """'Report an issue' button on venue cards -> moderation queue."""
    row = db.create_issue_report(principal.tenant_id, place_id, principal.user_id, payload.issue_type, payload.details)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    return {"id": row["id"], "status": row["status"]}


@app.get("/admin/issue-reports")
def list_reports(status: str = "open", principal: Principal = Depends(get_principal)):
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    return db.list_issue_reports(principal.tenant_id, status)


@app.post("/admin/issue-reports/{report_id}/resolve")
def resolve_report(report_id: int, payload: ResolveBody, principal: Principal = Depends(get_principal)):
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    row = db.resolve_issue_report(principal.tenant_id, report_id, payload.accept)
    if not row:
        raise HTTPException(status_code=404, detail="report not found or already resolved")
    return row


@app.patch("/admin/places/{place_id}/verification")
def set_place_verification(place_id: int, payload: VerificationBody, principal: Principal = Depends(get_principal)):
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    row = db.set_verification(principal.tenant_id, place_id, payload.status, payload.source_id)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    return _enrich_place(row)


=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
@app.patch("/places/{place_id}/sentiment")
def update_place_sentiment(
    place_id: int,
    payload: SentimentUpdate,
<<<<<<< HEAD
    principal: Principal = Depends(get_principal),
):
    # Sentiment is written by the sentiment-worker (tenant-level, no user identity), not by end users.
    if principal.user_id is not None and principal.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    tenant_id = principal.tenant_id
=======
    tenant_id: str = Depends(require_tenant),
):
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    row = db.update_place_sentiment(tenant_id, place_id, payload.sentiment_score, payload.ambience_add)
    if not row:
        raise HTTPException(status_code=404, detail="place not found")
    try:
        from eventbus import publish
        publish("place.updated", {
            "tenant_id": tenant_id,
            "place_id": place_id,
            "reason": "sentiment_updated",
        })
        publish("sentiment.updated", {
            "tenant_id": tenant_id,
            "place_id": place_id,
            "sentiment_score": payload.sentiment_score,
        })
    except Exception as e:  # noqa: BLE001
        print(f"[place-service] failed to publish sentiment events for place {place_id}: {e}")
    return _enrich_place(row)



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
    return _enrich_place(result)


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
