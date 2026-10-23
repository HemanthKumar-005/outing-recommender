import os
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

<<<<<<< HEAD
from eventbus import publish  # type: ignore # noqa: E402
from tenant import require_tenant  # type: ignore # noqa: E402
from authctx import Principal, get_principal, require_self_or_admin  # type: ignore # noqa: E402
from observability import setup_observability  # type: ignore # noqa: E402
=======
try:
    from shared.eventbus import publish  # type: ignore # noqa: E402
    from shared.tenant import require_tenant  # type: ignore # noqa: E402
except ImportError:
    from eventbus import publish  # type: ignore # noqa: E402
    from tenant import require_tenant  # type: ignore # noqa: E402
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

from . import db

app = FastAPI(title="Interaction Tracking Service")
<<<<<<< HEAD
setup_observability(app, "interaction-service")
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8


class InteractionCreate(BaseModel):
    user_id: int
    place_id: int
    type: str | None = None
    event_type: str | None = None
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
<<<<<<< HEAD
def create_interaction(payload: InteractionCreate, principal: Principal = Depends(get_principal)):
    interaction_type = payload.type or payload.event_type
    if not interaction_type or interaction_type not in db.VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(db.VALID_TYPES)}")
    # An end user can only record interactions for themselves.
    require_self_or_admin(principal, payload.user_id)
    try:
        interaction = db.create_interaction(
            principal.tenant_id, payload.user_id, payload.place_id, interaction_type, payload.rating, payload.context,
        )
    except Exception as e:  # noqa: BLE001  (FK violation: unknown user/place in this tenant)
        raise HTTPException(status_code=400, detail="unknown user or place") from e
=======
def create_interaction(payload: InteractionCreate, tenant_id: str = Depends(require_tenant)):
    interaction_type = payload.type or payload.event_type
    if not interaction_type or interaction_type not in db.VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(db.VALID_TYPES)}")
    interaction = db.create_interaction(
        tenant_id, payload.user_id, payload.place_id, interaction_type, payload.rating, payload.context,
    )
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    publish("interactions", interaction)
    return interaction


@app.post("/events", status_code=201)
<<<<<<< HEAD
def create_event(payload: InteractionCreate, principal: Principal = Depends(get_principal)):
    return create_interaction(payload, principal)


@app.get("/users/{user_id}/interactions")
def get_user_interactions(user_id: int, principal: Principal = Depends(get_principal)):
    require_self_or_admin(principal, user_id)
    return db.list_by_user(principal.tenant_id, user_id)


@app.get("/places/{place_id}/interactions")
def get_place_interactions(place_id: int, principal: Principal = Depends(get_principal)):
    if not principal.is_admin:  # other people's interactions with a place are not yours to read
        raise HTTPException(status_code=403, detail="forbidden")
    return db.list_by_place(principal.tenant_id, place_id)


@app.get("/interactions")
def get_all_interactions(limit: int = 5000, principal: Principal = Depends(get_principal)):
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    return db.list_all(principal.tenant_id, min(limit, 20000))
=======
def create_event(payload: InteractionCreate, tenant_id: str = Depends(require_tenant)):
    return create_interaction(payload, tenant_id)


@app.get("/users/{user_id}/interactions")
def get_user_interactions(user_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_by_user(tenant_id, user_id)


@app.get("/places/{place_id}/interactions")
def get_place_interactions(place_id: int, tenant_id: str = Depends(require_tenant)):
    return db.list_by_place(tenant_id, place_id)


@app.get("/interactions")
def get_all_interactions(limit: int = 5000, tenant_id: str = Depends(require_tenant)):
    return db.list_all(tenant_id, limit)
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
