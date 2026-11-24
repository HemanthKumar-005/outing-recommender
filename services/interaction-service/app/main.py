import os
import sys

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db

try:
    from shared.logging_config import configure_logging
    from shared.request_id_middleware import RequestIdMiddleware
    from shared.sentry_config import init_sentry
except ImportError:
    from logging_config import configure_logging
    from request_id_middleware import RequestIdMiddleware
    from sentry_config import init_sentry

init_sentry("interaction-service")
logger = configure_logging("interaction-service")

app = FastAPI(title="Interaction Tracking Service")
app.add_middleware(RequestIdMiddleware)

RETRAIN_THRESHOLD = int(os.environ.get("RETRAIN_INTERACTION_THRESHOLD", "100"))
_interaction_counter = 0


def _maybe_trigger_retrain(tenant_id: str):
    global _interaction_counter
    _interaction_counter += 1
    if _interaction_counter % 50 != 0:
        return
    try:
        count = db.count_interactions(tenant_id)
        if count >= RETRAIN_THRESHOLD:
            publish("interactions.threshold_reached", {"count": count, "tenant_id": tenant_id})
            logger.info(f"Published interactions.threshold_reached (count={count})")
    except Exception as e:
        logger.warning(f"Could not check interaction count for retrain trigger: {e}")


class InteractionCreate(BaseModel):
    user_id: int
    place_id: int
    type: str
    rating: float | None = Field(None, ge=0, le=5)
    context: dict = {}  # snapshot of context at interaction time (weather, time_of_day, etc.)


@app.get("/health")
def health():
    return {"status": "ok", "service": "interaction-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.list_all(tenant_id, limit=1)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


@app.post("/interactions", status_code=201)
def create_interaction(payload: InteractionCreate, request: Request, tenant_id: str = Depends(require_tenant)):
    # IDOR fix: user_id in payload must match the authenticated caller
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id or str(payload.user_id) != str(x_user_id):
        raise HTTPException(status_code=403, detail="Forbidden: user_id in payload must match the authenticated caller")

    if payload.type not in db.VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(db.VALID_TYPES)}")
    interaction = db.create_interaction(
        tenant_id, payload.user_id, payload.place_id, payload.type, payload.rating, payload.context,
    )
    publish("interactions", interaction)
    _maybe_trigger_retrain(tenant_id)
    return interaction


@app.get("/users/{user_id}/interactions")
def get_user_interactions(user_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    # IDOR fix: user_id in payload must match the authenticated caller
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id or str(user_id) != str(x_user_id):
        raise HTTPException(status_code=403, detail="Forbidden: user_id in payload must match the authenticated caller")

    return db.list_by_user(tenant_id, user_id)


@app.get("/places/{place_id}/interactions")
def get_place_interactions(place_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_by_place(tenant_id, place_id)


@app.get("/interactions")
def get_all_interactions(limit: int = 5000, tenant_id: str = Depends(require_tenant)):
    return db.list_all(tenant_id, limit)
