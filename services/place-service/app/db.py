"""Place catalog queries (tenant-scoped via RLS)."""
from __future__ import annotations

import sys
from typing import Any

<<<<<<< HEAD
import os

=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402

<<<<<<< HEAD
# Launch setting: only venues a human has verified are shown to the public.
# Closed/rejected venues are ALWAYS hidden, regardless of this flag.
VERIFIED_ONLY = os.environ.get("VERIFIED_ONLY", "false").lower() == "true"
VISIBLE_SQL = (
    "verification_status = 'verified'" if VERIFIED_ONLY
    else "verification_status NOT IN ('closed', 'rejected')"
)

=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

def create_place(tenant_id: str, payload: dict[str, Any]) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """
            INSERT INTO places.places (
                tenant_id, name, category, subcategory, price_range, average_cost,
                rating, review_count, lat, lng, city, state, indoor_outdoor, ambience, tags,
                description, family_friendly, couple_friendly, friends_friendly,
                opening_hours, opening_hours_source, opening_hours_is_estimated,
<<<<<<< HEAD
                entry_fee, cost_for_two, pricing_source, pricing_is_estimated,
                source, source_id, verification_status, last_verified_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
=======
                entry_fee, cost_for_two, pricing_source, pricing_is_estimated
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
                payload.get("opening_hours_source", "category_default"),
                payload.get("opening_hours_is_estimated", True),
                payload.get("entry_fee", 0.0),
                payload.get("cost_for_two") or payload.get("average_cost"),
                payload.get("pricing_source", "category_default"),
                payload.get("pricing_is_estimated", True),
<<<<<<< HEAD
                payload.get("source", "unknown"),
                payload.get("source_id"),
                payload.get("verification_status", "unverified"),
                payload.get("last_verified_at"),
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            ),
        )
        return cur.fetchone()


def list_places(tenant_id: str, limit: int = 200) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
<<<<<<< HEAD
            f"SELECT * FROM places.places WHERE {VISIBLE_SQL} ORDER BY id DESC LIMIT %s",
=======
            "SELECT * FROM places.places ORDER BY id DESC LIMIT %s",
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            (limit,),
        )
        return cur.fetchall()


def get_place(tenant_id: str, place_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
<<<<<<< HEAD
        cur.execute(f"SELECT * FROM places.places WHERE id = %s AND {VISIBLE_SQL}", (place_id,))
=======
        cur.execute("SELECT * FROM places.places WHERE id = %s", (place_id,))
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
    clauses = [VISIBLE_SQL]
=======
    clauses = ["TRUE"]
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
    clauses = [VISIBLE_SQL]
=======
    clauses = ["TRUE"]
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
            f"SELECT * FROM places.places WHERE id = ANY(%s) AND {VISIBLE_SQL}",
=======
            "SELECT * FROM places.places WHERE id = ANY(%s)",
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            (ids,),
        )
        rows = cur.fetchall()
        by_id = {r["id"]: r for r in rows}
        return [by_id[i] for i in ids if i in by_id]


def update_place_sentiment(
    tenant_id: str,
    place_id: int,
    sentiment_score: float,
    ambience_add: list[str] | None = None,
) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        if ambience_add:
            cur.execute(
                """
                UPDATE places.places
                SET sentiment_score = %s,
                    ambience = (
                        SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
                        FROM jsonb_array_elements_text(COALESCE(ambience, '[]'::jsonb) || %s::jsonb) AS elem
                    )
                WHERE id = %s
                RETURNING *
                """,
                (sentiment_score, Json(ambience_add), place_id),
            )
        else:
            cur.execute(
                """
                UPDATE places.places
                SET sentiment_score = %s
                WHERE id = %s
                RETURNING *
                """,
                (sentiment_score, place_id),
            )
        return cur.fetchone()

<<<<<<< HEAD


# ------------------------------------------------------------------ moderation
def create_issue_report(tenant_id: str, place_id: int, reporter_id: int | None,
                        issue_type: str, details: str) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT 1 FROM places.places WHERE id = %s", (place_id,))
        if not cur.fetchone():
            return None
        cur.execute(
            """INSERT INTO places.issue_reports (tenant_id, place_id, reporter_id, issue_type, details)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (tenant_id, place_id, reporter_id, issue_type, details[:2000]),
        )
        return cur.fetchone()


def list_issue_reports(tenant_id: str, status: str = "open", limit: int = 100) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """SELECT r.*, p.name AS place_name, p.city AS place_city
               FROM places.issue_reports r JOIN places.places p ON p.id = r.place_id
               WHERE r.status = %s ORDER BY r.created_at LIMIT %s""",
            (status, limit),
        )
        return cur.fetchall()


def resolve_issue_report(tenant_id: str, report_id: int, accept: bool) -> dict | None:
    """Accepting a report of type closed/does_not_exist hides the venue immediately."""
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """UPDATE places.issue_reports SET status = %s, resolved_at = now()
               WHERE id = %s AND status = 'open' RETURNING *""",
            ("accepted" if accept else "rejected", report_id),
        )
        row = cur.fetchone()
        if row and accept and row["issue_type"] in ("closed", "does_not_exist"):
            cur.execute(
                "UPDATE places.places SET verification_status = %s WHERE id = %s",
                ("closed" if row["issue_type"] == "closed" else "rejected", row["place_id"]),
            )
        return row


def set_verification(tenant_id: str, place_id: int, status: str, source_id: str | None = None) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """UPDATE places.places
               SET verification_status = %s,
                   source_id = COALESCE(%s, source_id),
                   last_verified_at = CASE WHEN %s = 'verified' THEN now() ELSE last_verified_at END
               WHERE id = %s RETURNING *""",
            (status, source_id, status, place_id),
        )
        return cur.fetchone()
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
