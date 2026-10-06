"""
Config-driven date/outing plan builder.

All templates, tips, budget labels, and constraints come from YAML configs
via shared.config_loader — nothing occasion-specific is hard-coded here.
"""
from __future__ import annotations

import math
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

sys.path.insert(0, "/shared")
from config_loader import (  # noqa: E402
    brewery_safety_note,
    budget_band,
    constraints_for,
    description_for,
    duration_meta,
    tips_for,
    timeline_for,
    title_for,
)
from occasion_scoring import rank_by_occasion  # noqa: E402


def _haversine_km(a: dict, b: dict) -> float:
    r = 6371.0
    lat1, lon1 = math.radians(a["lat"]), math.radians(a["lng"])
    lat2, lon2 = math.radians(b["lat"]), math.radians(b["lng"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def order_nearest_neighbour(places: list[dict], start_lat: float, start_lng: float) -> list[dict]:
    """Greedy NN tour — efficient for small stop counts (≤ max_stops)."""
    if not places:
        return []
    remaining = list(places)
    ordered: list[dict] = []
    current = {"lat": start_lat, "lng": start_lng}
    while remaining:
        remaining.sort(key=lambda p: _haversine_km(current, p))
        nxt = remaining.pop(0)
        ordered.append(nxt)
        current = nxt
    return ordered


def estimate_budget(places: list[dict], band_id: str) -> str:
    band = budget_band(band_id)
    total = sum(float(p.get("average_cost") or 0) for p in places)
    # Prefer explicit band label; fall back to summed estimate
    label = band.get("inr_label")
    if total > 0 and not label:
        return f"≈ ₹{int(total)}"
    if total > 0 and label:
        return f"{label} (est. ₹{int(total)} for stops)"
    return label or "Budget flexible"


def pick_backup(
    candidates: list[dict],
    selected_ids: set[int],
    occasion: str | None,
    strategy: str,
) -> dict | None:
    pool = [p for p in candidates if p.get("id") not in selected_ids]
    if not pool:
        return None

    if strategy == "indoor_bar_or_cafe":
        indoor = [
            p for p in pool
            if p.get("indoor_outdoor") in ("indoor", "both")
            and (p.get("category") in ("bar", "cafe") or "brewery" in (p.get("tags") or []))
        ]
        pool = indoor or pool
    elif strategy == "indoor_quiet":
        indoor = [
            p for p in pool
            if p.get("indoor_outdoor") in ("indoor", "both")
            and "quiet" in (p.get("ambience") or [])
        ]
        pool = indoor or [p for p in pool if p.get("indoor_outdoor") in ("indoor", "both")] or pool
    elif strategy == "cafe_or_park":
        preferred = [p for p in pool if p.get("category") in ("cafe", "park")]
        pool = preferred or pool
    elif strategy == "indoor_attraction":
        preferred = [
            p for p in pool
            if p.get("indoor_outdoor") in ("indoor", "both")
            and p.get("category") in ("museum", "attraction", "cinema")
        ]
        pool = preferred or pool
    elif strategy == "alternate_category":
        used_cats = {p.get("category") for p in candidates if p.get("id") in selected_ids}
        alt = [p for p in pool if p.get("category") not in used_cats]
        pool = alt or pool

    ranked = rank_by_occasion(pool, occasion)
    return ranked[0][0] if ranked else pool[0]


def build_timeline(
    ordered: list[dict],
    start: datetime,
    duration: str,
    occasion: str | None,
    gap_minutes: int,
) -> list[dict[str, Any]]:
    template = timeline_for(duration, occasion)
    timeline: list[dict[str, Any]] = []

    if template and ordered:
        # Align template slots to ordered places (cycle if more slots than places)
        for i, step in enumerate(template):
            place = ordered[i % len(ordered)]
            t = start + timedelta(minutes=int(step.get("offset_min", i * gap_minutes)))
            timeline.append(
                {
                    "time": t.strftime("%I:%M %p").lstrip("0") if hasattr(t, "strftime") else str(t),
                    "time_iso": t.isoformat(),
                    "activity": step.get("activity") or "Visit",
                    "role": step.get("role"),
                    "place_id": place.get("id"),
                    "place_name": place.get("name"),
                    "category": place.get("category"),
                }
            )
    else:
        # Fallback: equal spacing
        for i, place in enumerate(ordered):
            t = start + timedelta(minutes=i * gap_minutes)
            timeline.append(
                {
                    "time": t.strftime("%I:%M %p").lstrip("0"),
                    "time_iso": t.isoformat(),
                    "activity": f"Visit {place.get('name')}",
                    "role": "stop",
                    "place_id": place.get("id"),
                    "place_name": place.get("name"),
                    "category": place.get("category"),
                }
            )
    return timeline


def schedule_items(
    ordered: list[dict],
    start: datetime,
    gap_minutes: int,
    dwell_minutes: int = 75,
) -> list[dict[str, Any]]:
    items = []
    cursor = start
    for place in ordered:
        arrival = cursor
        departure = arrival + timedelta(minutes=dwell_minutes)
        items.append(
            {
                "place_id": place["id"],
                "name": place["name"],
                "category": place.get("category") or "attraction",
                "indoor_outdoor": place.get("indoor_outdoor") or "indoor",
                "lat": place["lat"],
                "lng": place["lng"],
                "arrival": arrival.isoformat(),
                "departure": departure.isoformat(),
            }
        )
        cursor = departure + timedelta(minutes=max(15, gap_minutes // 4))
    return items


def generate_plan(
    *,
    places: list[dict],
    candidate_pool: list[dict] | None = None,
    occasion: str | None,
    duration: str,
    budget: str,
    start_time: datetime | None,
    lat: float,
    lng: float,
    area_label: str = "your area",
) -> dict[str, Any]:
    """
    Build a full plan dict ready for persistence + API response.
    `places` = selected stops; `candidate_pool` used for backup selection.
    """
    constraints = constraints_for(occasion)
    max_stops = int(constraints.get("max_stops") or duration_meta(duration).get("default_stops") or 3)
    gap = int(constraints.get("min_gap_minutes") or 60)
    preferred_hour = int(constraints.get("preferred_start_hour") or 10)
    strategy = constraints.get("backup_strategy") or "alternate_category"

    if start_time is None:
        now = datetime.now(timezone.utc).astimezone()
        start_time = now.replace(hour=preferred_hour, minute=0, second=0, microsecond=0)
        if start_time < now:
            start_time += timedelta(days=1)

    # Rank selected places by occasion then NN-order from user location
    ranked = rank_by_occasion(places, occasion)
    selected = [p for p, _, _ in ranked][:max_stops]
    ordered = order_nearest_neighbour(selected, lat, lng)

    timeline = build_timeline(ordered, start_time, duration, occasion, gap)
    items = schedule_items(ordered, start_time, gap)
    end_time = (
        datetime.fromisoformat(items[-1]["departure"]) if items else start_time + timedelta(hours=4)
    )

    selected_ids = {p["id"] for p in ordered}
    pool = candidate_pool or places
    backup = pick_backup(pool, selected_ids, occasion, strategy)
    backup_text = None
    if backup:
        backup_text = (
            f"If plans change, try {backup.get('name')} "
            f"({backup.get('category')}) nearby as a substitute."
        )

    includes_breweries = any(
        (p.get("category") == "bar")
        or (p.get("subcategory") == "brewery")
        or ("brewery" in (p.get("tags") or []))
        for p in ordered
    )

    tips = tips_for(occasion)
    if includes_breweries:
        note = brewery_safety_note()
        if note and note not in tips:
            tips = list(tips) + [note]

    return {
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat() if isinstance(end_time, datetime) else str(end_time),
        "occasion": occasion,
        "duration": duration,
        "title": title_for(occasion, area_label),
        "description": description_for(occasion, duration),
        "budget_estimate": estimate_budget(ordered, budget),
        "romantic_tips": tips,
        "backup_plan": backup_text,
        "timeline_meta": timeline,
        "includes_breweries": includes_breweries,
        "items": items,
        "places": ordered,
    }
