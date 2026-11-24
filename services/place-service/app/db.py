import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402


def create_place(tenant_id: str, p: dict) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO places.places
               (tenant_id, name, category, subcategory, price_range, average_cost, rating,
                review_count, lat, lng, indoor_outdoor, ambience, tags, description,
                family_friendly, couple_friendly, friends_friendly, opening_hours,
                sentiment_score, popularity_score, hours_verified, data_source, verified_at, verification_notes, booking_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (tenant_id, p["name"], p["category"], p.get("subcategory"), p.get("price_range", 2),
             p.get("average_cost"), p.get("rating"), p.get("review_count", 0),
             p["lat"], p["lng"], p.get("indoor_outdoor", "indoor"),
             Json(p.get("ambience", [])), Json(p.get("tags", [])), p.get("description", ""),
             p.get("family_friendly", False), p.get("couple_friendly", False),
             p.get("friends_friendly", False), Json(p.get("opening_hours", {})),
             p.get("sentiment_score", 0.5), p.get("popularity_score", 0.5),
             p.get("hours_verified", False), p.get("data_source", "estimated"),
             p.get("verified_at"), p.get("verification_notes"),
             p.get("booking_url")),
        )
        return cur.fetchone()


def get_user_report_count_today(tenant_id: str, user_id: int) -> int:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """SELECT COUNT(*) AS count FROM places.venue_reports
               WHERE user_id = %s AND created_at >= now() - interval '1 day'""",
            (user_id,),
        )
        row = cur.fetchone()
        return row["count"] if row else 0


def create_venue_report(tenant_id: str, place_id: int, user_id: int, issue_type: str, description: str | None) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO places.venue_reports (tenant_id, place_id, user_id, issue_type, description)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, place_id, user_id, issue_type, created_at, resolved""",
            (tenant_id, place_id, user_id, issue_type, description),
        )
        return cur.fetchone()


def get_place(tenant_id: str, place_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM places.places WHERE id = %s", (place_id,))
        return cur.fetchone()


def update_sentiment(tenant_id: str, place_id: int, sentiment_score: float) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "UPDATE places.places SET sentiment_score = %s WHERE id = %s RETURNING *",
            (sentiment_score, place_id),
        )
        return cur.fetchone()


def list_places(tenant_id: str, category: str | None = None, min_price: int | None = None,
                 max_price: int | None = None, lat_range: tuple | None = None,
                 lng_range: tuple | None = None, limit: int = 200) -> list:
    query = "SELECT * FROM places.places WHERE 1=1"
    params: list = []
    if category:
        query += " AND category = %s"
        params.append(category)
    if min_price is not None:
        query += " AND price_range >= %s"
        params.append(min_price)
    if max_price is not None:
        query += " AND price_range <= %s"
        params.append(max_price)
    if lat_range:
        query += " AND lat BETWEEN %s AND %s"
        params.extend(lat_range)
    if lng_range:
        query += " AND lng BETWEEN %s AND %s"
        params.extend(lng_range)
    query += " LIMIT %s"
    params.append(limit)
    with tenant_cursor(tenant_id) as cur:
        cur.execute(query, params)
        return cur.fetchall()
