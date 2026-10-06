"""Itinerary service — generate-plan, refine, CRUD."""
from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from config_loader import list_occasions_public  # noqa: E402
from tenant import require_tenant  # noqa: E402

from . import db
from .planner import generate_plan

app = FastAPI(title="Itinerary Service")

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")
_client = httpx.AsyncClient(timeout=8.0)


class GeneratePlanRequest(BaseModel):
    user_id: int | None = None
    place_ids: list[int] = Field(default_factory=list)
    occasion: str | None = None
    duration: str = "4-6 hours"
    budget: str = "medium"
    start_time: str | None = None  # ISO
    lat: float = 28.6139
    lng: float = 77.2090
    radius_km: float = 15.0
    area_label: str = "your area"
    persist: bool = True


class RefineRequest(BaseModel):
    feedback: str
    occasion: str | None = None
    duration: str | None = None
    budget: str | None = None


def _headers(tenant_id: str) -> dict[str, str]:
    return {"X-Tenant-Id": tenant_id, "Content-Type": "application/json"}


async def _fetch_places(tenant_id: str, place_ids: list[int] | None = None) -> list[dict]:
    if place_ids:
        # Fetch individually (small N); parallel would be nicer at scale
        places = []
        for pid in place_ids:
            r = await _client.get(
                f"{PLACE_SERVICE_URL}/places/{pid}",
                headers=_headers(tenant_id),
            )
            if r.status_code == 200:
                places.append(r.json())
        return places
    r = await _client.get(
        f"{PLACE_SERVICE_URL}/places",
        params={"limit": 100},
        headers=_headers(tenant_id),
    )
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else data.get("places", data)


@app.get("/health")
def health():
    return {"status": "ok", "service": "itinerary-service"}


@app.get("/occasions")
def occasions():
    return {"occasions": list_occasions_public()}


@app.post("/generate-plan")
async def generate_plan_endpoint(
    body: GeneratePlanRequest,
    tenant_id: str = Depends(require_tenant),
):
    selected = await _fetch_places(tenant_id, body.place_ids or None)
    if not selected:
        # Auto-pick from catalog when client didn't select spots
        pool = await _fetch_places(tenant_id, None)
        if not pool:
            raise HTTPException(status_code=400, detail="no places available to plan")
        selected = pool[:6]
    else:
        pool = await _fetch_places(tenant_id, None)

    start = None
    if body.start_time:
        try:
            start = datetime.fromisoformat(body.start_time.replace("Z", "+00:00"))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"invalid start_time: {e}") from e

    plan = generate_plan(
        places=selected,
        candidate_pool=pool,
        occasion=body.occasion,
        duration=body.duration,
        budget=body.budget,
        start_time=start,
        lat=body.lat,
        lng=body.lng,
        area_label=body.area_label,
    )

    if not body.persist:
        return {"success": True, "data": plan}

    row = db.create_itinerary(
        tenant_id,
        {
            "user_id": body.user_id,
            "start_time": plan["start_time"],
            "end_time": plan["end_time"],
            "occasion": plan["occasion"],
            "duration": plan["duration"],
            "title": plan["title"],
            "description": plan["description"],
            "budget_estimate": plan["budget_estimate"],
            "romantic_tips": plan["romantic_tips"],
            "backup_plan": plan["backup_plan"],
            "timeline_meta": plan["timeline_meta"],
            "includes_breweries": plan["includes_breweries"],
        },
    )
    items_out = []
    for item in plan["items"]:
        items_out.append(db.add_item(tenant_id, row["id"], item))

    return {
        "success": True,
        "data": {
            **plan,
            "itinerary_id": row["id"],
            "items": items_out,
        },
    }


@app.post("/itineraries/{itinerary_id}/refine")
async def refine_plan(
    itinerary_id: int,
    body: RefineRequest,
    tenant_id: str = Depends(require_tenant),
):
    existing = db.get_itinerary(tenant_id, itinerary_id)
    if not existing:
        raise HTTPException(status_code=404, detail="itinerary not found")

    items = db.list_items(tenant_id, itinerary_id)
    place_ids = [i["place_id"] for i in items]
    places = await _fetch_places(tenant_id, place_ids)
    pool = await _fetch_places(tenant_id, None)

    occasion = body.occasion or existing.get("occasion")
    duration = body.duration or existing.get("duration") or "4-6 hours"
    budget = body.budget or "medium"

    # Lightweight feedback heuristics — still config-backed via occasion swap
    fb = (body.feedback or "").lower()
    if "brewery" in fb or "beer" in fb:
        occasion = "brewery_tour"
    elif "romantic" in fb or "intimate" in fb:
        occasion = "romantic"
    elif "adventure" in fb or "trek" in fb:
        occasion = "adventure"
    elif "cultural" in fb or "heritage" in fb:
        occasion = "cultural"
    elif "cheap" in fb or "budget" in fb:
        budget = "low"
    elif "premium" in fb or "luxury" in fb:
        budget = "high"

    start = existing.get("start_time")
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace("Z", "+00:00"))

    plan = generate_plan(
        places=places or pool[:6],
        candidate_pool=pool,
        occasion=occasion,
        duration=duration,
        budget=budget,
        start_time=start if isinstance(start, datetime) else None,
        lat=float(items[0]["lat"]) if items else 28.6139,
        lng=float(items[0]["lng"]) if items else 77.2090,
        area_label="your area",
    )
    plan["title"] = f"Refined: {plan['title']}"
    plan["description"] = f"Improved based on your feedback: \"{body.feedback}\""

    updated = db.update_plan_fields(
        tenant_id,
        itinerary_id,
        {
            "title": plan["title"],
            "description": plan["description"],
            "budget_estimate": plan["budget_estimate"],
            "romantic_tips": plan["romantic_tips"],
            "backup_plan": plan["backup_plan"],
            "timeline_meta": plan["timeline_meta"],
            "includes_breweries": plan["includes_breweries"],
            "occasion": plan["occasion"],
            "duration": plan["duration"],
        },
    )
    return {"success": True, "data": {**plan, "itinerary_id": itinerary_id, "record": updated}}


@app.get("/itineraries")
def list_itineraries(
    user_id: int | None = None,
    limit: int = 50,
    tenant_id: str = Depends(require_tenant),
):
    return db.list_itineraries(tenant_id, user_id, limit)


@app.get("/itineraries/{itinerary_id}")
def get_itinerary(itinerary_id: int, tenant_id: str = Depends(require_tenant)):
    row = db.get_itinerary(tenant_id, itinerary_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    items = db.list_items(tenant_id, itinerary_id)
    return {**row, "items": items}
