import sys

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

sys.path.insert(0, "/shared")
from eventbus import consume_in_background  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db

app = FastAPI(title="Notification Service")


class NotificationCreate(BaseModel):
    user_id: int
    title: str
    body: str
    channel: str = "push"


def _on_message(routing_key: str, payload: dict):
    if routing_key == "notification.send":
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            print(f"[notification-service] dropping notification.send with no tenant_id: {payload}")
            return
        db.create_notification(
            tenant_id, payload.get("user_id"), payload.get("title", ""), payload.get("body", ""),
            payload.get("channel", "push"),
        )
        print(f"[notification-service] (simulated send) tenant={tenant_id} -> "
              f"user {payload.get('user_id')}: {payload.get('title')}")


@app.on_event("startup")
def startup():
    consume_in_background("notification-service.sends", ["notification.send"], _on_message)


@app.get("/health")
def health():
    return {"status": "ok", "service": "notification-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.list_for_user(tenant_id, -1)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


@app.post("/notifications", status_code=201)
def create_notification(payload: NotificationCreate, tenant_id: str = Depends(require_tenant)):
    """Direct REST path for testing; production sends normally flow via the
    `notification.send` event instead."""
    return db.create_notification(tenant_id, payload.user_id, payload.title, payload.body, payload.channel)


@app.get("/users/{user_id}/notifications")
def get_notifications(user_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_for_user(tenant_id, user_id)
