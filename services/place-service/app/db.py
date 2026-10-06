"""Place catalog queries (tenant-scoped via RLS)."""
from __future__ import annotations

import sys
from typing import Any

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402


def create_place(tenant_id: str, payload: dict[str, Any]) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """
            INSERT INTO places.places (
                tenant_id, name, category, subcategory, price_range, average_cost,
                rating, review_count, lat, lng, city, state, indoor_outdoor, ambience, tags,
                description, family_friendly, couple_friendly, friends_friendly,
                opening_hours
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING *
            """,
            (
                tenant_id,
                payload["name"],
                payload["category"],
                payload.get("subcategory"),
                payload.get("price_range", 2),
                payload.get("average_cost"),
                payload.get("rating"),
                payload.get("review_count", 0),
                payload["lat"],
                payload["lng"],
                payload.get("city"),
                payload.get("state"),
                payload.get("indoor_outdoor", "indoor"),
                Json(payload.get("ambience") or []),
                Json(payload.get("tags") or []),
                payload.get("description") or "",
                payload.get("family_friendly", False),
                payload.get("couple_friendly", False),
                payload.get("friends_friendly", False),
                Json(payload.get("opening_hours") or {}),
            ),
        )
        return cur.fetchone()


def list_places(tenant_id: str, limit: int = 200) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM places.places ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        return cur.fetchall()


def get_place(tenant_id: str, place_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM places.places WHERE id = %s", (place_id,))
        return cur.fetchone()


def surprise_place(
    tenant_id: str,
    *,
    category: str | None = None,
    keyword: str | None = None,
    occasion_tags: list[str] | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    exclude_ids: list[int] | None = None,
) -> dict | None:
    """
    Efficient random sample with optional filters.
    Uses ORDER BY random() LIMIT 1 on a filtered set — fine for catalog sizes
    typical of a tenant demo; for very large catalogs switch to TABLESAMPLE.
    """
    clauses = ["TRUE"]
    params: list[Any] = []

    if category:
        clauses.append("category = %s")
        params.append(category)

    if keyword:
        # Case-insensitive match on name, subcategory, description, or tags text
        clauses.append(
            "(name ILIKE %s OR COALESCE(subcategory, '') ILIKE %s "
            "OR description ILIKE %s OR tags::text ILIKE %s)"
        )
        like = f"%{keyword}%"
        params.extend([like, like, like, like])

    if occasion_tags:
        # Overlap between place.tags (jsonb array) and preferred tags
        clauses.append("tags ?| %s")
        params.append(occasion_tags)

    if lat is not None and lng is not None and radius_km is not None:
        # Haversine approximation in SQL (km)
        clauses.append(
            """(
              6371 * acos(
                least(1.0, greatest(-1.0,
                  cos(radians(%s)) * cos(radians(lat)) * cos(radians(lng) - radians(%s))
                  + sin(radians(%s)) * sin(radians(lat))
                ))
              )
            ) <= %s"""
        )
        params.extend([lat, lng, lat, radius_km])

    if exclude_ids:
        clauses.append("id <> ALL(%s)")
        params.append(exclude_ids)

    where = " AND ".join(clauses)
    sql = f"SELECT * FROM places.places WHERE {where} ORDER BY random() LIMIT 1"

    with tenant_cursor(tenant_id) as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def search_places(
    tenant_id: str,
    *,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    city: str | None = None,
    state: str | None = None,
    category: str | None = None,
    q: str | None = None,
    limit: int = 50,
) -> list:
    """Geo + text search — recommendations never hard-code a place list."""
    clauses = ["TRUE"]
    params: list[Any] = []
    if city:
        clauses.append("city ILIKE %s")
        params.append(city)
    if state:
        clauses.append("state ILIKE %s")
        params.append(state)
    if category:
        clauses.append("category = %s")
        params.append(category)
    if q:
        like = f"%{q}%"
        clauses.append(
            "(name ILIKE %s OR COALESCE(subcategory,'') ILIKE %s "
            "OR description ILIKE %s OR COALESCE(city,'') ILIKE %s)"
        )
        params.extend([like, like, like, like])
    if lat is not None and lng is not None and radius_km is not None:
        clauses.append(
            """(
              6371 * acos(
                least(1.0, greatest(-1.0,
                  cos(radians(%s)) * cos(radians(lat)) * cos(radians(lng) - radians(%s))
                  + sin(radians(%s)) * sin(radians(lat))
                ))
              )
            ) <= %s"""
        )
        params.extend([lat, lng, lat, radius_km])
    where = " AND ".join(clauses)
    params.append(limit)
    sql = f"SELECT * FROM places.places WHERE {where} ORDER BY rating DESC NULLS LAST LIMIT %s"
    with tenant_cursor(tenant_id) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def places_by_ids(tenant_id: str, ids: list[int]) -> list:
    if not ids:
        return []
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM places.places WHERE id = ANY(%s)",
            (ids,),
        )
        rows = cur.fetchall()
        by_id = {r["id"]: r for r in rows}
        return [by_id[i] for i in ids if i in by_id]
