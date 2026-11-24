import math
import secrets
import sys
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel

sys.path.insert(0, "/shared")
from eventbus import consume_in_background  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db, workers

try:
    from shared.logging_config import configure_logging
    from shared.request_id_middleware import RequestIdMiddleware
    from shared.sentry_config import init_sentry
except ImportError:
    from logging_config import configure_logging
    from request_id_middleware import RequestIdMiddleware
    from sentry_config import init_sentry

init_sentry("itinerary-service")
logger = configure_logging("itinerary-service")

app = FastAPI(title="Itinerary Service")
app.add_middleware(RequestIdMiddleware)

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
            logger.info(f"marked {updated} itinerary item(s) rated "
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


@app.post("/itinerary/{itinerary_id}/share")
def share_itinerary(itinerary_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing X-User-Id header")

    itinerary = db.get_itinerary(tenant_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found")

    if itinerary.get("user_id") is not None and str(itinerary["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="not authorized to share this itinerary")

    share_token = itinerary.get("share_token")
    if not share_token:
        share_token = secrets.token_urlsafe(16)
        db.set_share_token(tenant_id, itinerary_id, share_token)

    return {
        "share_token": share_token,
        "share_url": f"/itinerary/share/{share_token}",
    }


def _escape_ics(text: str) -> str:
    if not text:
        return ""
    return str(text).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _format_ics_dt(val, itinerary_date=None, fallback_offset_hours=0) -> str:
    """Formats a datetime into UTC iCalendar format YYYYMMDDTHHMMSSZ."""
    if isinstance(val, datetime):
        dt = val
    elif isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val)
        except Exception:
            try:
                # If it's a time string like "14:00" or "14:00:00"
                parts = [int(p) for p in val.split(":")[:2]]
                base_date = itinerary_date or (datetime.now(timezone.utc) + timedelta(days=1)).date()
                dt = datetime(base_date.year, base_date.month, base_date.day, parts[0], parts[1], tzinfo=timezone.utc)
            except Exception:
                dt = datetime.now(timezone.utc) + timedelta(days=1, hours=fallback_offset_hours)
    else:
        dt = datetime.now(timezone.utc) + timedelta(days=1, hours=fallback_offset_hours)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _build_ics(itinerary_id: int | str, items: list, start_time=None) -> str:
    now_utc = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    itinerary_date = None
    if start_time:
        if isinstance(start_time, datetime):
            itinerary_date = start_time.date()
        elif isinstance(start_time, str):
            try:
                itinerary_date = datetime.fromisoformat(start_time).date()
            except Exception:
                pass

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Nearby//Outing Recommender//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for item in items:
        stop_id = item.get("id") or item.get("place_id") or secrets.token_hex(4)
        summary = item.get("name") or "Outing Stop"
        dtstart = _format_ics_dt(item.get("arrival"), itinerary_date=itinerary_date, fallback_offset_hours=0)
        dtend = _format_ics_dt(item.get("departure"), itinerary_date=itinerary_date, fallback_offset_hours=1)
        location = item.get("address") or (f"{item.get('lat')}, {item.get('lng')}" if item.get("lat") and item.get("lng") else "")
        notes = item.get("notes") or ""
        category = item.get("category") or "venue"
        desc_parts = []
        if notes:
            desc_parts.append(notes)
        desc_parts.append(f"Category: {category}")
        description = " — ".join(desc_parts)

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:itinerary-{itinerary_id}-stop-{stop_id}@nearby.app",
            f"DTSTAMP:{now_utc}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{_escape_ics(summary)}",
            f"DESCRIPTION:{_escape_ics(description)}",
        ])
        if location:
            lines.append(f"LOCATION:{_escape_ics(location)}")
        if item.get("booking_url"):
            lines.append(f"URL:{item['booking_url']}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _build_google_calendar_links(itinerary: dict) -> dict:
    from urllib.parse import urlencode

    start_time = itinerary.get("start_time")
    itinerary_date = None
    if start_time:
        if isinstance(start_time, datetime):
            itinerary_date = start_time.date()
        elif isinstance(start_time, str):
            try:
                itinerary_date = datetime.fromisoformat(start_time).date()
            except Exception:
                pass

    events = []
    for item in itinerary.get("items", []):
        dtstart = _format_ics_dt(item.get("arrival"), itinerary_date=itinerary_date, fallback_offset_hours=0)
        dtend = _format_ics_dt(item.get("departure"), itinerary_date=itinerary_date, fallback_offset_hours=1)
        name = item.get("name") or "Outing Stop"
        location = item.get("address") or (f"{item.get('lat')}, {item.get('lng')}" if item.get("lat") and item.get("lng") else "")
        desc = f"Category: {item.get('category', 'venue')}"
        if item.get("booking_url"):
            desc += f"\nReservation: {item['booking_url']}"
        params = {
            "action": "TEMPLATE",
            "text": name,
            "dates": f"{dtstart}/{dtend}",
            "details": desc,
            "location": location,
        }
        events.append({
            "place_name": name,
            "google_calendar_url": f"https://calendar.google.com/calendar/render?{urlencode(params)}",
        })

    return {
        "itinerary_id": itinerary.get("id"),
        "events": events,
    }


@app.get("/itinerary/{itinerary_id}/export.ics")
def export_itinerary_ics(itinerary_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing X-User-Id header")

    itinerary = db.get_itinerary(tenant_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found")

    if itinerary.get("user_id") is not None and str(itinerary["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="not authorized to export this itinerary")

    ics_content = _build_ics(itinerary_id, itinerary.get("items", []), start_time=itinerary.get("start_time"))
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="outing-plan-{itinerary_id}.ics"',
        },
    )


@app.get("/itinerary/{itinerary_id}/google-calendar")
def get_google_calendar(itinerary_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing X-User-Id header")

    itinerary = db.get_itinerary(tenant_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found")

    if itinerary.get("user_id") is not None and str(itinerary["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="not authorized to export this itinerary")

    return _build_google_calendar_links(itinerary)


@app.get("/itinerary/share/{share_token}/export.ics")
def export_shared_itinerary_ics(share_token: str):
    itinerary = db.get_itinerary_by_share_token(share_token)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found or revoked")

    ics_content = _build_ics(share_token, itinerary.get("items", []), start_time=itinerary.get("start_time"))
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="outing-plan-{share_token}.ics"',
        },
    )


@app.get("/itinerary/share/{share_token}")
def get_shared_itinerary(share_token: str):
    itinerary = db.get_itinerary_by_share_token(share_token)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found or revoked")

    stops = []
    for item in itinerary.get("items", []):
        arrival_val = item.get("arrival")
        time_str = (
            arrival_val.strftime("%H:%M")
            if hasattr(arrival_val, "strftime")
            else str(arrival_val)[11:16] if len(str(arrival_val)) >= 16 else str(arrival_val)
        )
        stops.append({
            "place_id": item.get("place_id"),
            "place_name": item.get("name"),
            "name": item.get("name"),
            "time": time_str,
            "category": item.get("category"),
            "lat": item.get("lat"),
            "lng": item.get("lng"),
            "booking_url": item.get("booking_url"),
            "notes": None,
        })

    return {
        "title": "Outing Plan",
        "start_time": (
            itinerary["start_time"].isoformat()
            if hasattr(itinerary["start_time"], "isoformat")
            else str(itinerary["start_time"])
        ),
        "end_time": (
            itinerary["end_time"].isoformat()
            if hasattr(itinerary["end_time"], "isoformat")
            else str(itinerary["end_time"])
        ),
        "stops": stops,
        "items": stops,
    }


@app.post("/itinerary/{itinerary_id}/unshare")
def unshare_itinerary(itinerary_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    user_id = request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing X-User-Id header")

    itinerary = db.get_itinerary(tenant_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="itinerary not found")

    if itinerary.get("user_id") is not None and str(itinerary["user_id"]) != str(user_id):
        raise HTTPException(status_code=403, detail="not authorized to modify this itinerary")

    db.clear_share_token(tenant_id, itinerary_id)
    return {"unshared": True}


@app.post("/itinerary")
@app.post("/generate-plan")
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
