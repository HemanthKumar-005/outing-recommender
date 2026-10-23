import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402
from psycopg.types.json import Json  # noqa: E402

<<<<<<< HEAD
_PUBLIC_COLUMNS = (
    "id, tenant_id, name, email, age_group, budget_min, budget_max, preferred_categories, "
    "ambience_preferences, preferred_distance_km, preferred_outing_type, preferred_occasions, "
    "preferred_duration, home_lat, home_lng, role, email_verified_at, terms_accepted_at, "
    "terms_version, location_consent_at, created_at"
)



=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

def create_user(tenant_id: str, name: str, email: str, budget_min: int, budget_max: int,
                 preferred_categories: list, ambience_preferences: list,
                 home_lat: float | None, home_lng: float | None,
                 age_group: str | None = None, preferred_distance_km: float = 10,
                 preferred_outing_type: str = "friends",
                 preferred_occasions: list | None = None, preferred_duration: str = "4-6 hours") -> dict:
    if preferred_occasions is None:
        preferred_occasions = []
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO users.users
               (tenant_id, name, email, age_group, budget_min, budget_max, preferred_categories,
                ambience_preferences, preferred_distance_km, preferred_outing_type, home_lat, home_lng,
                preferred_occasions, preferred_duration)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
<<<<<<< HEAD
               RETURNING """ + _PUBLIC_COLUMNS,
=======
               RETURNING *""",
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            (tenant_id, name, email, age_group, budget_min, budget_max, Json(preferred_categories),
             Json(ambience_preferences), preferred_distance_km, preferred_outing_type, home_lat, home_lng,
             Json(preferred_occasions), preferred_duration),
        )
        return cur.fetchone()


def get_user(tenant_id: str, user_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
<<<<<<< HEAD
        cur.execute(f"SELECT {_PUBLIC_COLUMNS} FROM users.users WHERE id = %s", (user_id,))
=======
        cur.execute("SELECT * FROM users.users WHERE id = %s", (user_id,))
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
               WHERE id=%s RETURNING """ + _PUBLIC_COLUMNS,
=======
               WHERE id=%s RETURNING *""",
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            (budget_min, budget_max, Json(preferred_categories), Json(ambience_preferences),
             preferred_distance_km, preferred_outing_type, Json(preferred_occasions), preferred_duration, user_id),
        )
        return cur.fetchone()


def list_users(tenant_id: str) -> list:
    with tenant_cursor(tenant_id) as cur:
<<<<<<< HEAD
        cur.execute(f"SELECT {_PUBLIC_COLUMNS} FROM users.users ORDER BY id")
        return cur.fetchall()


# --------------------------------------------------------------------------
# Authentication helpers (credentials never leave this service in clear text)
# --------------------------------------------------------------------------
from datetime import datetime, timedelta, timezone  # noqa: E402

def _public(row: dict | None) -> dict | None:
    """Strip credential fields. get_user() returns SELECT * which includes password_hash."""
    if row is None:
        return None
    row = dict(row)
    row.pop("password_hash", None)
    return row


def get_user_public(tenant_id: str, user_id: int) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(f"SELECT {_PUBLIC_COLUMNS} FROM users.users WHERE id = %s", (user_id,))
        return cur.fetchone()


def get_auth_row_by_email(tenant_id: str, email: str) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT * FROM users.users WHERE lower(email) = lower(%s)", (email,))
        return cur.fetchone()


def register_user(tenant_id: str, name: str, email: str, password_hash: str,
                  terms_version: str, token_hash: str, token_ttl_hours: int = 24,
                  auto_verify: bool = False) -> dict | None:
    """Insert a new credentialed user plus a verification token, atomically.
    Returns None if the email is already registered (caller must not reveal this)."""
    now = datetime.now(timezone.utc)
    with tenant_cursor(tenant_id) as cur:
        cur.execute("SELECT 1 FROM users.users WHERE lower(email) = lower(%s)", (email,))
        if cur.fetchone():
            return None
        cur.execute(
            f"""INSERT INTO users.users (tenant_id, name, email, password_hash, terms_accepted_at,
                                         terms_version, email_verified_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING {_PUBLIC_COLUMNS}""",
            (tenant_id, name, email, password_hash, now, terms_version, now if auto_verify else None),
        )
        user = cur.fetchone()
        cur.execute(
            """INSERT INTO users.email_tokens (tenant_id, user_id, token_hash, purpose, expires_at)
               VALUES (%s, %s, %s, 'verify_email', %s)""",
            (tenant_id, user["id"], token_hash, now + timedelta(hours=token_ttl_hours)),
        )
        return user


def consume_email_token(tenant_id: str, token_hash: str) -> dict | None:
    now = datetime.now(timezone.utc)
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """UPDATE users.email_tokens SET used_at = %s
               WHERE token_hash = %s AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > %s
               RETURNING user_id""",
            (now, token_hash, now),
        )
        row = cur.fetchone()
        if not row:
            return None
        cur.execute(
            f"UPDATE users.users SET email_verified_at = %s WHERE id = %s RETURNING {_PUBLIC_COLUMNS}",
            (now, row["user_id"]),
        )
        return cur.fetchone()


def replace_verification_token(tenant_id: str, user_id: int, token_hash: str, ttl_hours: int = 24) -> None:
    now = datetime.now(timezone.utc)
    with tenant_cursor(tenant_id) as cur:
        cur.execute("DELETE FROM users.email_tokens WHERE user_id = %s AND purpose = 'verify_email' AND used_at IS NULL", (user_id,))
        cur.execute(
            """INSERT INTO users.email_tokens (tenant_id, user_id, token_hash, purpose, expires_at)
               VALUES (%s, %s, %s, 'verify_email', %s)""",
            (tenant_id, user_id, token_hash, now + timedelta(hours=ttl_hours)),
        )


def update_password_hash(tenant_id: str, user_id: int, password_hash: str) -> None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute("UPDATE users.users SET password_hash = %s WHERE id = %s", (password_hash, user_id))


def record_location_consent(tenant_id: str, user_id: int, granted: bool) -> dict | None:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            f"UPDATE users.users SET location_consent_at = {'now()' if granted else 'NULL'} "
            f"WHERE id = %s RETURNING {_PUBLIC_COLUMNS}",
            (user_id,),
        )
        return cur.fetchone()


def delete_user(tenant_id: str, user_id: int) -> bool:
    """Hard-delete the user. FK ON DELETE CASCADE removes interactions, itineraries
    (and their items), notifications and tokens in the same transaction."""
    with tenant_cursor(tenant_id) as cur:
        cur.execute("DELETE FROM users.users WHERE id = %s", (user_id,))
        return cur.rowcount > 0
=======
        cur.execute("SELECT * FROM users.users ORDER BY id")
        return cur.fetchall()
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
