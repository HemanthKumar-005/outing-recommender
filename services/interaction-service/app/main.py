import sys

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db

app = FastAPI(title="Interaction Tracking Service")


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
def create_interaction(payload: InteractionCreate, tenant_id: str = Depends(require_tenant)):
    if payload.type not in db.VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(db.VALID_TYPES)}")
    interaction = db.create_interaction(
        tenant_id, payload.user_id, payload.place_id, payload.type, payload.rating, payload.context,
    )
    publish("interactions", interaction)
    return interaction


@app.get("/users/{user_id}/interactions")
def get_user_interactions(user_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_by_user(tenant_id, user_id)


@app.get("/places/{place_id}/interactions")
def get_place_interactions(place_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_by_place(tenant_id, place_id)


@app.get("/interactions")
def get_all_interactions(limit: int = 5000, tenant_id: str = Depends(require_tenant)):
    return db.list_all(tenant_id, limit)
