"""Itinerary service — generate-plan, refine, CRUD."""
from __future__ import annotations

import os
import sys
from datetime import datetime

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from config_loader import list_occasions_public  # noqa: E402
from tenant import require_tenant  # noqa: E402
from authctx import Principal, get_principal  # noqa: E402
from observability import propagate_headers, setup_observability  # noqa: E402

from . import db
from .planner import generate_plan, resequence_plan

app = FastAPI(title="Itinerary Service")
setup_observability(app, "itinerary-service")

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


class ReorderRequest(BaseModel):
    place_ids: list[int]


class SwapRequest(BaseModel):
    old_place_id: int
    new_place_id: int


def _headers(tenant_id: str) -> dict[str, str]:
    return propagate_headers({"X-Tenant-Id": tenant_id, "Content-Type": "application/json"})


def _owned_itinerary(principal: Principal, itinerary_id: int) -> dict:
    """Load an itinerary and make sure the caller owns it (404 otherwise, never 403)."""
    row = db.get_itinerary(principal.tenant_id, itinerary_id)
    if not row or not (principal.is_admin or row.get("user_id") == principal.user_id):
        raise HTTPException(status_code=404, detail="itinerary not found")
    return row


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
    principal: Principal = Depends(get_principal),
):
    tenant_id = principal.tenant_id
    if principal.user_id is not None and not principal.is_admin:
        body.user_id = principal.user_id  # never trust a client-supplied user_id
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
    principal: Principal = Depends(get_principal),
):
    tenant_id = principal.tenant_id
    existing = _owned_itinerary(principal, itinerary_id)

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
    principal: Principal = Depends(get_principal),
):
    if not principal.is_admin:
        user_id = principal.user_id  # end users only ever see their own plans
    return db.list_itineraries(principal.tenant_id, user_id, min(limit, 200))


@app.get("/itineraries/{itinerary_id}")
def get_itinerary(itinerary_id: int, principal: Principal = Depends(get_principal)):
    row = _owned_itinerary(principal, itinerary_id)
    items = db.list_items(principal.tenant_id, itinerary_id)
    return {**row, "items": items}


# ------------------------------------------------------------------ sharing
import secrets  # noqa: E402


@app.post("/itineraries/{itinerary_id}/share")
def share_itinerary(itinerary_id: int, principal: Principal = Depends(get_principal)):
    """Create (or return) a read-only share token for an itinerary the caller owns."""
    row = _owned_itinerary(principal, itinerary_id)
    token = row.get("share_token") or secrets.token_urlsafe(16)
    db.set_share_token(principal.tenant_id, itinerary_id, token)
    return {"share_token": token, "path": f"/itinerary/share/{token}"}


@app.delete("/itineraries/{itinerary_id}/share")
def unshare_itinerary(itinerary_id: int, principal: Principal = Depends(get_principal)):
    _owned_itinerary(principal, itinerary_id)
    db.set_share_token(principal.tenant_id, itinerary_id, None)
    return {"status": "unshared"}


@app.get("/shared/{share_token}")
def get_shared_itinerary(share_token: str, tenant_id: str = Depends(require_tenant)):
    """Public, read-only view. Exposes the plan only: no user id, no email, no other fields."""
    row = db.get_by_share_token(tenant_id, share_token)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    items = db.list_items(tenant_id, row["id"])
    public_fields = ("title", "description", "occasion", "duration", "budget_estimate",
                     "romantic_tips", "backup_plan", "timeline_meta", "start_time", "end_time")
    return {**{k: row.get(k) for k in public_fields},
            "items": [{k: it.get(k) for k in ("name", "category", "lat", "lng", "arrival", "departure")} for it in items]}


# ---------------------------------------------------------------- .ics export
def _ics_escape(text: str) -> str:
    return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def build_ics(title: str, items: list[dict]) -> str:
    """Plain RFC 5545 calendar file: works with Google/Apple/Outlook calendars, needs no API key."""
    from datetime import timezone as _tz

    def fmt(dt) -> str:
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        return dt.astimezone(_tz.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nearby & Co.//Itinerary//EN", "CALSCALE:GREGORIAN"]
    stamp = datetime.now(_tz.utc).strftime("%Y%m%dT%H%M%SZ")
    for i, it in enumerate(items):
        lines += [
            "BEGIN:VEVENT",
            f"UID:{secrets.token_hex(8)}-{i}@nearby.co",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{fmt(it['arrival'])}",
            f"DTEND:{fmt(it['departure'])}",
            f"SUMMARY:{_ics_escape(it['name'])}",
            f"DESCRIPTION:{_ics_escape(title)} (stop {i + 1}). Hours and prices may be estimates - verify before you go.",
            f"GEO:{float(it['lat']):.6f};{float(it['lng']):.6f}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@app.get("/itineraries/{itinerary_id}/calendar.ics")
def itinerary_ics(itinerary_id: int, principal: Principal = Depends(get_principal)):
    from fastapi.responses import Response as _Resp

    row = _owned_itinerary(principal, itinerary_id)
    items = db.list_items(principal.tenant_id, itinerary_id)
    return _Resp(
        content=build_ics(row.get("title") or "Outing", items),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="outing-{itinerary_id}.ics"'},
    )


@app.post("/itineraries/{itinerary_id}/reorder")
async def reorder_itinerary(
    itinerary_id: int,
    body: ReorderRequest,
    principal: Principal = Depends(get_principal),
):
    tenant_id = principal.tenant_id
    existing = _owned_itinerary(principal, itinerary_id)

    places = await _fetch_places(tenant_id, body.place_ids)
    if not places:
        raise HTTPException(status_code=400, detail="no valid places provided for reordering")

    places_by_id = {p["id"]: p for p in places}
    ordered_places = [places_by_id[pid] for pid in body.place_ids if pid in places_by_id]
    if len(ordered_places) != len(body.place_ids):
        raise HTTPException(status_code=400, detail="some places could not be loaded")

    start = existing.get("start_time")
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace("Z", "+00:00"))

    pool = await _fetch_places(tenant_id, None)
    plan = resequence_plan(
        places=ordered_places,
        candidate_pool=pool,
        occasion=existing.get("occasion"),
        duration=existing.get("duration") or "4-6 hours",
        budget=existing.get("budget_estimate") or "medium",
        start_time=start if isinstance(start, datetime) else None,
        area_label="your area",
    )

    db.update_plan_fields(
        tenant_id,
        itinerary_id,
        {
            "start_time": plan["start_time"],
            "end_time": plan["end_time"],
            "timeline_meta": plan["timeline_meta"],
            "includes_breweries": plan["includes_breweries"],
        },
    )
    items_out = db.replace_items(tenant_id, itinerary_id, plan["items"])
    return {
        "success": True,
        "data": {
            **plan,
            "itinerary_id": itinerary_id,
            "items": items_out,
        },
    }


@app.post("/itineraries/{itinerary_id}/swap")
async def swap_itinerary_stop(
    itinerary_id: int,
    body: SwapRequest,
    principal: Principal = Depends(get_principal),
):
    tenant_id = principal.tenant_id
    existing = _owned_itinerary(principal, itinerary_id)

    current_items = db.list_items(tenant_id, itinerary_id)
    place_ids = [it["place_id"] for it in current_items]
    if body.old_place_id not in place_ids:
        raise HTTPException(status_code=400, detail=f"Stop {body.old_place_id} is not in this itinerary")

    new_place_ids = [body.new_place_id if pid == body.old_place_id else pid for pid in place_ids]
    places = await _fetch_places(tenant_id, new_place_ids)
    places_by_id = {p["id"]: p for p in places}
    ordered_places = [places_by_id[pid] for pid in new_place_ids if pid in places_by_id]

    start = existing.get("start_time")
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace("Z", "+00:00"))

    pool = await _fetch_places(tenant_id, None)
    plan = resequence_plan(
        places=ordered_places,
        candidate_pool=pool,
        occasion=existing.get("occasion"),
        duration=existing.get("duration") or "4-6 hours",
        budget=existing.get("budget_estimate") or "medium",
        start_time=start if isinstance(start, datetime) else None,
        area_label="your area",
    )

    db.update_plan_fields(
        tenant_id,
        itinerary_id,
        {
            "start_time": plan["start_time"],
            "end_time": plan["end_time"],
            "timeline_meta": plan["timeline_meta"],
            "includes_breweries": plan["includes_breweries"],
        },
    )
    items_out = db.replace_items(tenant_id, itinerary_id, plan["items"])
    return {
        "success": True,
        "data": {
            **plan,
            "itinerary_id": itinerary_id,
            "items": items_out,
        },
    }


@app.get("/itineraries/{itinerary_id}/backups")
async def get_itinerary_backups(
    itinerary_id: int,
    principal: Principal = Depends(get_principal),
):
    tenant_id = principal.tenant_id
    existing = _owned_itinerary(principal, itinerary_id)
    items = db.list_items(tenant_id, itinerary_id)
    current_ids = {it["place_id"] for it in items}
    pool = await _fetch_places(tenant_id, None)
    backups = [p for p in pool if p.get("id") not in current_ids][:12]
    return {"success": True, "backups": backups}
