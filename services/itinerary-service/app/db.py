import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402


def create_itinerary(tenant_id: str, user_id: int | None, start_time: str, end_time: str, items: list) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "INSERT INTO itineraries.itineraries (tenant_id, user_id, start_time, end_time) "
            "VALUES (%s, %s, %s, %s) RETURNING *",
            (tenant_id, user_id, start_time, end_time),
        )
        itinerary = cur.fetchone()
        for item in items:
            cur.execute(
                """INSERT INTO itineraries.itinerary_items
                   (tenant_id, itinerary_id, place_id, name, category, indoor_outdoor, lat, lng, arrival, departure)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (tenant_id, itinerary["id"], item["place_id"], item["name"], item["category"],
                 item.get("indoor_outdoor", "indoor"), item["lat"], item["lng"],
                 item["arrival"], item["departure"]),
            )
    return get_itinerary(tenant_id, itinerary["id"])


def get_itinerary(tenant_id: str, itinerary_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM itineraries.itineraries WHERE id = %s", (itinerary_id,))
        itinerary = cur.fetchone()
        if not itinerary:
            return None
        cur.execute(
            "SELECT * FROM itineraries.itinerary_items WHERE itinerary_id = %s ORDER BY arrival",
            (itinerary_id,),
        )
        items = cur.fetchall()
    return {**itinerary, "items": items}


def due_for_feedback_reminder(tenant_id: str, now_iso: str) -> list:
    """Items whose visit window has ended, haven't been rated, and haven't
    already had a reminder sent, for one tenant."""
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """SELECT ii.*, it.user_id FROM itineraries.itinerary_items ii
               JOIN itineraries.itineraries it ON it.id = ii.itinerary_id
               WHERE ii.departure < %s AND ii.rated = false AND ii.reminder_sent = false
                 AND it.user_id IS NOT NULL""",
            (now_iso,),
        )
        return cur.fetchall()


def upcoming_items(tenant_id: str, now_iso: str, horizon_iso: str) -> list:
    """Items arriving within the given horizon that haven't had a weather
    alert sent yet, for one tenant."""
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """SELECT ii.*, it.user_id FROM itineraries.itinerary_items ii
               JOIN itineraries.itineraries it ON it.id = ii.itinerary_id
               WHERE ii.arrival BETWEEN %s AND %s AND ii.weather_alert_sent = false
                 AND it.user_id IS NOT NULL""",
            (now_iso, horizon_iso),
        )
        return cur.fetchall()


def mark_reminder_sent(tenant_id: str, item_id: int) -> None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("UPDATE itineraries.itinerary_items SET reminder_sent = true WHERE id = %s", (item_id,))


def mark_weather_alert_sent(tenant_id: str, item_id: int) -> None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("UPDATE itineraries.itinerary_items SET weather_alert_sent = true WHERE id = %s", (item_id,))


def mark_rated(tenant_id: str, user_id: int, place_id: int) -> int:
    """Called when an `interactions` event with type=rating arrives. Marks
    any matching not-yet-rated items as rated. Returns rows updated."""
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """UPDATE itineraries.itinerary_items SET rated = true
               WHERE place_id = %s AND rated = false
                 AND itinerary_id IN (SELECT id FROM itineraries.itineraries WHERE user_id = %s)""",
            (place_id, user_id),
        )
        return cur.rowcount
