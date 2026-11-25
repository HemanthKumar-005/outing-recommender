import os
import sys
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, FastAPI, HTTPException, Request
from jose import jwt
from pydantic import BaseModel, EmailStr, Field

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

init_sentry("user-service")
logger = configure_logging("user-service")

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

app = FastAPI(title="User Service")
app.add_middleware(RequestIdMiddleware)
ph = PasswordHasher()


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    age_group: str | None = None
    budget_min: int = Field(0, ge=0, le=4)
    budget_max: int = Field(4, ge=0, le=4)
    preferred_categories: list[str] = []
    ambience_preferences: list[str] = []
    preferred_distance_km: float = 10.0
    preferred_outing_type: str = Field("friends", pattern="^(couple|friends|family|solo)$")
    home_lat: float | None = None
    home_lng: float | None = None


class PreferencesUpdate(BaseModel):
    budget_min: int | None = None
    budget_max: int | None = None
    preferred_categories: list[str] | None = None
    ambience_preferences: list[str] | None = None
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


def _register_user(payload: UserRegister, tenant_id: str):
    existing = db.get_user_by_email(tenant_id, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    pwd_hash = ph.hash(payload.password)
    try:
        user = db.create_user(
            tenant_id=tenant_id,
            name=payload.name,
            email=payload.email,
            password_hash=pwd_hash,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not register user: {e}")

    publish("user.updated", {"tenant_id": tenant_id, "user_id": user["id"], "reason": "registered"})
    return {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
    }


@app.post("/users/register", status_code=201)
def register(payload: UserRegister, tenant_id: str = Depends(require_tenant)):
    return _register_user(payload, tenant_id)


@app.post("/register", status_code=201)
def register_alias(payload: UserRegister, tenant_id: str = Depends(require_tenant)):
    return _register_user(payload, tenant_id)


def _login_user(payload: UserLogin, tenant_id: str):
    user = db.get_user_by_email(tenant_id, payload.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        ph.verify(user["password_hash"], payload.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    now = datetime.now(timezone.utc)
    token_payload = {
        "user_id": user["id"],
        "tenant_id": str(tenant_id),
        "email": user["email"],
        "name": user.get("name"),
        "exp": now + timedelta(hours=24),
        "iat": now,
    }
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.post("/users/login")
def login(payload: UserLogin, tenant_id: str = Depends(require_tenant)):
    return _login_user(payload, tenant_id)


@app.post("/login")
def login_alias(payload: UserLogin, tenant_id: str = Depends(require_tenant)):
    return _login_user(payload, tenant_id)


def _delete_current_user(request: Request, tenant_id: str):
    # GDPR / DPDP Art. 13: full erasure on request
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing user identity")

    user_id = int(x_user_id)
    deleted = db.delete_user(tenant_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")

    publish("user.deleted", {"tenant_id": tenant_id, "user_id": user_id, "reason": "erasure_request"})
    return {"deleted": True}


@app.delete("/users/me")
def delete_me(request: Request, tenant_id: str = Depends(require_tenant)):
    return _delete_current_user(request, tenant_id)


@app.delete("/me")
def delete_me_alias(request: Request, tenant_id: str = Depends(require_tenant)):
    return _delete_current_user(request, tenant_id)


@app.post("/users", status_code=201)
def create_user(payload: UserCreate, tenant_id: str = Depends(require_tenant)):
    try:
        user = db.create_user(
            tenant_id, payload.name, payload.email, payload.budget_min, payload.budget_max,
            payload.preferred_categories, payload.ambience_preferences,
            payload.home_lat, payload.home_lng, payload.age_group,
            payload.preferred_distance_km, payload.preferred_outing_type,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not create user: {e}")
    publish("user.updated", {"tenant_id": tenant_id, "user_id": user["id"], "reason": "created"})
    user.pop("password_hash", None)
    return user


@app.get("/users")
def list_users(request: Request, tenant_id: str = Depends(require_tenant)):
    x_user_id = request.headers.get("x-user-id")
    if x_user_id:
        user = db.get_user(tenant_id, int(x_user_id))
        if user:
            user.pop("password_hash", None)
            return [user]
        return []
    users = db.list_users(tenant_id)
    for u in users:
        u.pop("password_hash", None)
    return users


@app.get("/users/{user_id}")
def get_user(user_id: int, request: Request, tenant_id: str = Depends(require_tenant)):
    # IDOR fix: callers may only access their own user record
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id or str(user_id) != str(x_user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.get_user(tenant_id, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    user.pop("password_hash", None)
    return user


@app.put("/users/{user_id}/preferences")
def update_preferences(user_id: int, payload: PreferencesUpdate, request: Request, tenant_id: str = Depends(require_tenant)):
    # IDOR fix: callers may only access their own user record
    x_user_id = request.headers.get("x-user-id")
    if not x_user_id or str(user_id) != str(x_user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.update_preferences(
        tenant_id, user_id, payload.budget_min, payload.budget_max,
        payload.preferred_categories, payload.ambience_preferences,
        payload.preferred_distance_km, payload.preferred_outing_type,
    )
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    user.pop("password_hash", None)
    publish("user.updated", {"tenant_id": tenant_id, "user_id": user_id, "reason": "preferences_updated"})
    return user
