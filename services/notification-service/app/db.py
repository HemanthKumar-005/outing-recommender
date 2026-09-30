import sys

sys.path.insert(0, "/shared")
from pgdb import tenant_cursor  # noqa: E402


def create_notification(tenant_id: str, user_id: int, title: str, body: str, channel: str) -> dict:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            """INSERT INTO notifications.notifications (tenant_id, user_id, title, body, channel, sent)
               VALUES (%s, %s, %s, %s, %s, true) RETURNING *""",
            (tenant_id, user_id, title, body, channel),
        )
        return cur.fetchone()


def list_for_user(tenant_id: str, user_id: int) -> list:
    with tenant_cursor(tenant_id) as cur:
        cur.execute(
            "SELECT * FROM notifications.notifications WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        return cur.fetchall()
