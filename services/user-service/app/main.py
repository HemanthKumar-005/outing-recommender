import sys

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import db

app = FastAPI(title="User Service")


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    age_group: str | None = None
    budget_min: int = Field(0, ge=0, le=4)
    budget_max: int = Field(4, ge=0, le=4)
    preferred_categories: list[str] = []
    ambience_preferences: list[str] = []
    preferred_occasions: list[str] = []
    preferred_duration: str = "4-6 hours"
    preferred_distance_km: float = 10.0
    preferred_outing_type: str = Field("friends", pattern="^(couple|friends|family|solo)$")
    home_lat: float | None = None
    home_lng: float | None = None


class PreferencesUpdate(BaseModel):
    budget_min: int | None = None
    budget_max: int | None = None
    preferred_categories: list[str] | None = None
    ambience_preferences: list[str] | None = None
    preferred_occasions: list[str] | None = None
    preferred_duration: str | None = None
    preferred_distance_km: float | None = None
    preferred_outing_type: str | None = Field(None, pattern="^(couple|friends|family|solo)$")


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.list_users(tenant_id)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


@app.post("/users", status_code=201)
def create_user(payload: UserCreate, tenant_id: str = Depends(require_tenant)):
    try:
        user = db.create_user(
            tenant_id, payload.name, payload.email, payload.budget_min, payload.budget_max,
            payload.preferred_categories, payload.ambience_preferences,
            payload.home_lat, payload.home_lng, payload.age_group,
            payload.preferred_distance_km, payload.preferred_outing_type,
            payload.preferred_occasions, payload.preferred_duration
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not create user: {e}")
    publish("user.updated", {"tenant_id": tenant_id, "user_id": user["id"], "reason": "created"})
    return user


@app.get("/users")
def list_users(tenant_id: str = Depends(require_tenant)):
    return db.list_users(tenant_id)


@app.get("/users/{user_id}")
def get_user(user_id: int, tenant_id: str = Depends(require_tenant)):
    user = db.get_user(tenant_id, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@app.put("/users/{user_id}/preferences")
def update_preferences(user_id: int, payload: PreferencesUpdate, tenant_id: str = Depends(require_tenant)):
    user = db.update_preferences(
        tenant_id, user_id, payload.budget_min, payload.budget_max,
        payload.preferred_categories, payload.ambience_preferences,
        payload.preferred_distance_km, payload.preferred_outing_type,
        payload.preferred_occasions, payload.preferred_duration
    )
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    publish("user.updated", {"tenant_id": tenant_id, "user_id": user_id, "reason": "preferences_updated"})
    return user
