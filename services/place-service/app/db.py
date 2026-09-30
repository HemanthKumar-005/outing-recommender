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
                sentiment_score, popularity_score)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (tenant_id, p["name"], p["category"], p.get("subcategory"), p.get("price_range", 2),
             p.get("average_cost"), p.get("rating"), p.get("review_count", 0),
             p["lat"], p["lng"], p.get("indoor_outdoor", "indoor"),
             Json(p.get("ambience", [])), Json(p.get("tags", [])), p.get("description", ""),
             p.get("family_friendly", False), p.get("couple_friendly", False),
             p.get("friends_friendly", False), Json(p.get("opening_hours", {})),
             p.get("sentiment_score", 0.5), p.get("popularity_score", 0.5)),
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
