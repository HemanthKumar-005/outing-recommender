import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402

VALID_TYPES = {"view", "click", "save", "visit", "rating", "share", "skip"}
POSITIVE_TYPES = ("save", "visit", "rating", "share")


def create_interaction(tenant_id: str, user_id: int, place_id: int, type_: str,
                        rating: float | None, context: dict | None = None) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO interactions.interactions (tenant_id, user_id, place_id, type, rating, context)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
            (tenant_id, user_id, place_id, type_, rating, Json(context or {})),
        )
        return cur.fetchone()


def list_by_user(tenant_id: str, user_id: int, limit: int = 200) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM interactions.interactions WHERE user_id = %s ORDER BY ts DESC LIMIT %s",
            (user_id, limit),
        )
        return cur.fetchall()


def list_by_place(tenant_id: str, place_id: int, limit: int = 500) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM interactions.interactions WHERE place_id = %s ORDER BY ts DESC LIMIT %s",
            (place_id, limit),
        )
        return cur.fetchall()


def list_all(tenant_id: str, limit: int = 5000) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM interactions.interactions ORDER BY ts DESC LIMIT %s", (limit,))
        return cur.fetchall()
