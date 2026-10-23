import os
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

<<<<<<< HEAD
from eventbus import consume_in_background  # type: ignore # noqa: E402
from tenant import require_tenant  # type: ignore # noqa: E402
from authctx import Principal, get_principal, require_self_or_admin  # type: ignore # noqa: E402
from observability import setup_observability  # type: ignore # noqa: E402
=======
try:
    from shared.eventbus import consume_in_background  # type: ignore # noqa: E402
    from shared.tenant import require_tenant  # type: ignore # noqa: E402
except ImportError:
    from eventbus import consume_in_background  # type: ignore # noqa: E402
    from tenant import require_tenant  # type: ignore # noqa: E402
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

from . import db

app = FastAPI(title="Notification Service")
<<<<<<< HEAD
setup_observability(app, "notification-service")
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8


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
<<<<<<< HEAD
def create_notification(payload: NotificationCreate, principal: Principal = Depends(get_principal)):
    """Direct REST path for tenant-level callers; end users cannot push notifications to anyone."""
    if principal.user_id is not None and principal.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return db.create_notification(principal.tenant_id, payload.user_id, payload.title, payload.body, payload.channel)


@app.get("/users/{user_id}/notifications")
def get_notifications(user_id: int, principal: Principal = Depends(get_principal)):
    require_self_or_admin(principal, user_id)
    return db.list_for_user(principal.tenant_id, user_id)
=======
def create_notification(payload: NotificationCreate, tenant_id: str = Depends(require_tenant)):
    """Direct REST path for testing; production sends normally flow via the
    `notification.send` event instead."""
    return db.create_notification(tenant_id, payload.user_id, payload.title, payload.body, payload.channel)


@app.get("/users/{user_id}/notifications")
def get_notifications(user_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_for_user(tenant_id, user_id)
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
