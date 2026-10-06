import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402


def create_user(tenant_id: str, name: str, email: str, budget_min: int, budget_max: int,
                 preferred_categories: list, ambience_preferences: list,
                 home_lat: float | None, home_lng: float | None,
                 age_group: str | None = None, preferred_distance_km: float = 10,
                 preferred_outing_type: str = "friends",
                 preferred_occasions: list = None, preferred_duration: str = "4-6 hours") -> dict:
    if preferred_occasions is None:
        preferred_occasions = []
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO users.users
               (tenant_id, name, email, age_group, budget_min, budget_max, preferred_categories,
                ambience_preferences, preferred_distance_km, preferred_outing_type, home_lat, home_lng,
                preferred_occasions, preferred_duration)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (tenant_id, name, email, age_group, budget_min, budget_max, Json(preferred_categories),
             Json(ambience_preferences), preferred_distance_km, preferred_outing_type, home_lat, home_lng,
             Json(preferred_occasions), preferred_duration),
        )
        return cur.fetchone()


def get_user(tenant_id: str, user_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM users.users WHERE id = %s", (user_id,))
        return cur.fetchone()


def update_preferences(tenant_id: str, user_id: int, budget_min=None, budget_max=None,
                        preferred_categories=None, ambience_preferences=None,
                        preferred_distance_km=None, preferred_outing_type=None,
                        preferred_occasions=None, preferred_duration=None) -> dict | None:
    existing = get_user(tenant_id, user_id)
    if not existing:
        return None
    budget_min = existing["budget_min"] if budget_min is None else budget_min
    budget_max = existing["budget_max"] if budget_max is None else budget_max
    preferred_categories = existing["preferred_categories"] if preferred_categories is None else preferred_categories
    ambience_preferences = existing["ambience_preferences"] if ambience_preferences is None else ambience_preferences
    preferred_distance_km = existing["preferred_distance_km"] if preferred_distance_km is None else preferred_distance_km
    preferred_outing_type = existing["preferred_outing_type"] if preferred_outing_type is None else preferred_outing_type
    preferred_occasions = existing["preferred_occasions"] if preferred_occasions is None else preferred_occasions
    preferred_duration = existing["preferred_duration"] if preferred_duration is None else preferred_duration
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """UPDATE users.users SET budget_min=%s, budget_max=%s, preferred_categories=%s,
               ambience_preferences=%s, preferred_distance_km=%s, preferred_outing_type=%s,
               preferred_occasions=%s, preferred_duration=%s
               WHERE id=%s RETURNING *""",
            (budget_min, budget_max, Json(preferred_categories), Json(ambience_preferences),
             preferred_distance_km, preferred_outing_type, Json(preferred_occasions), preferred_duration, user_id),
        )
        return cur.fetchone()


def list_users(tenant_id: str) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM users.users ORDER BY id")
        return cur.fetchall()
