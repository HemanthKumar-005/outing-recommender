"""Itinerary persistence (tenant-scoped)."""
from __future__ import annotations

import sys
from typing import Any

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402


def create_itinerary(tenant_id: str, payload: dict[str, Any]) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """
            INSERT INTO itineraries.itineraries (
                tenant_id, user_id, start_time, end_time, occasion, duration,
                title, description, budget_estimate, romantic_tips, backup_plan,
                timeline_meta, includes_breweries
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING *
            """,
            (
                tenant_id,
                payload.get("user_id"),
                payload["start_time"],
                payload["end_time"],
                payload.get("occasion"),
                payload.get("duration"),
                payload.get("title"),
                payload.get("description"),
                payload.get("budget_estimate"),
                Json(payload.get("romantic_tips") or []),
                payload.get("backup_plan"),
                Json(payload.get("timeline_meta") or []),
                payload.get("includes_breweries", False),
            ),
        )
        return cur.fetchone()


def add_item(tenant_id: str, itinerary_id: int, item: dict[str, Any]) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """
            INSERT INTO itineraries.itinerary_items (
                tenant_id, itinerary_id, place_id, name, category,
                indoor_outdoor, lat, lng, arrival, departure
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *
            """,
            (
                tenant_id,
                itinerary_id,
                item["place_id"],
                item["name"],
                item["category"],
                item.get("indoor_outdoor", "indoor"),
                item["lat"],
                item["lng"],
                item["arrival"],
                item["departure"],
            ),
        )
        return cur.fetchone()


def get_itinerary(tenant_id: str, itinerary_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM itineraries.itineraries WHERE id = %s",
            (itinerary_id,),
        )
        return cur.fetchone()


def list_items(tenant_id: str, itinerary_id: int) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """SELECT * FROM itineraries.itinerary_items
               WHERE itinerary_id = %s ORDER BY arrival""",
            (itinerary_id,),
        )
        return cur.fetchall()


def list_itineraries(tenant_id: str, user_id: int | None = None, limit: int = 50) -> list:
    with tenant_cursor(tenant_id) as cur:
        if user_id is not None:
            cur.execute(
                """SELECT * FROM itineraries.itineraries
                   WHERE user_id = %s ORDER BY created_at DESC LIMIT %s""",
                (user_id, limit),
            )
        else:
            cur.execute(
                "SELECT * FROM itineraries.itineraries ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
        return cur.fetchall()


def update_plan_fields(tenant_id: str, itinerary_id: int, fields: dict[str, Any]) -> dict | None:
    allowed = {
        "title", "description", "budget_estimate", "romantic_tips",
        "backup_plan", "timeline_meta", "includes_breweries", "occasion", "duration",
    }
    sets = []
    params: list[Any] = []
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k in ("romantic_tips", "timeline_meta"):
            sets.append(f"{k} = %s")
            params.append(Json(v))
        else:
            sets.append(f"{k} = %s")
            params.append(v)
    if not sets:
        return get_itinerary(tenant_id, itinerary_id)
    params.extend([itinerary_id])
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            f"UPDATE itineraries.itineraries SET {', '.join(sets)} WHERE id = %s RETURNING *",
            params,
        )
        return cur.fetchone()
