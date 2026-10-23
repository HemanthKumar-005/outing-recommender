import os
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

from eventbus import publish  # type: ignore # noqa: E402
from tenant import require_tenant  # type: ignore # noqa: E402
from authctx import Principal, get_principal, require_self_or_admin  # type: ignore # noqa: E402
from security import (  # type: ignore # noqa: E402
    hash_password, hash_token, new_one_time_token, password_needs_rehash,
    safe_equals, validate_password_strength, verify_password,
)

from . import db

app = FastAPI(title="User Service")

TERMS_VERSION = os.environ.get("TERMS_VERSION", "2026-10-21")
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")


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
    budget_min: int | None = Field(None, ge=0, le=4)
    budget_max: int | None = Field(None, ge=0, le=4)
    preferred_categories: list[str] | None = None
    ambience_preferences: list[str] | None = None
    preferred_occasions: list[str] | None = None
    preferred_duration: str | None = None
    preferred_distance_km: float | None = Field(None, gt=0, le=500)
    preferred_outing_type: str | None = Field(None, pattern="^(couple|friends|family|solo)$")


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    accept_terms: bool
    require_verification: bool = True


class CredentialsRequest(BaseModel):
    email: EmailStr
    password: str


class TokenRequest(BaseModel):
    token: str


class ConsentRequest(BaseModel):
    location: bool


def require_internal(x_internal_token: str | None = Header(None, alias="X-Internal-Token")) -> None:
    """Credential endpoints are only callable by the api-gateway."""
    if not INTERNAL_SERVICE_TOKEN or not x_internal_token or not safe_equals(x_internal_token, INTERNAL_SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="forbidden")


@app.get("/health")
def health():
    return {"status": "ok", "service": "user-service"}


@app.get("/ready")
def ready(tenant_id: str = Depends(require_tenant)):
    try:
        db.get_user_public(tenant_id, -1)
        return {"status": "ready", "database": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database not ready: {e}")


# ----------------------------------------------------------------------------
# Internal authentication endpoints (api-gateway only)
# ----------------------------------------------------------------------------
@app.post("/internal/auth/register", status_code=201, dependencies=[Depends(require_internal)])
def internal_register(payload: RegisterRequest, tenant_id: str = Depends(require_tenant)):
    if not payload.accept_terms:
        raise HTTPException(status_code=400, detail="You must accept the Terms of Service and Privacy Policy.")
    err = validate_password_strength(payload.password, payload.email)
    if err:
        raise HTTPException(status_code=400, detail=err)
    token, token_hash = new_one_time_token()
    user = db.register_user(
        tenant_id, payload.name.strip(), payload.email.lower(), hash_password(payload.password),
        TERMS_VERSION, token_hash, auto_verify=not payload.require_verification,
    )
    if user is None:
        # Already registered: do not reveal. Gateway answers identically either way.
        return {"created": False}
    publish("user.updated", {"tenant_id": tenant_id, "user_id": user["id"], "reason": "created"})
    return {"created": True, "user": user, "verification_token": token}


@app.post("/internal/auth/verify-credentials", dependencies=[Depends(require_internal)])
def internal_verify_credentials(payload: CredentialsRequest, tenant_id: str = Depends(require_tenant)):
    row = db.get_auth_row_by_email(tenant_id, payload.email)
    ok = verify_password(row["password_hash"] if row else None, payload.password)
    if not ok or not row:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if password_needs_rehash(row["password_hash"]):
        db.update_password_hash(tenant_id, row["id"], hash_password(payload.password))
    user = db.get_user_public(tenant_id, row["id"])
    return {"user": user}


@app.post("/internal/auth/verify-email", dependencies=[Depends(require_internal)])
def internal_verify_email(payload: TokenRequest, tenant_id: str = Depends(require_tenant)):
    user = db.consume_email_token(tenant_id, hash_token(payload.token))
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")
    return {"user": user}


@app.post("/internal/auth/resend-verification", dependencies=[Depends(require_internal)])
def internal_resend(payload: CredentialsRequest, tenant_id: str = Depends(require_tenant)):
    row = db.get_auth_row_by_email(tenant_id, payload.email)
    if not row or row["email_verified_at"] or not verify_password(row["password_hash"], payload.password):
        return {"sent": False}
    token, token_hash = new_one_time_token()
    db.replace_verification_token(tenant_id, row["id"], token_hash)
    return {"sent": True, "verification_token": token, "name": row["name"], "email": row["email"]}


# ----------------------------------------------------------------------------
# User-facing endpoints
# ----------------------------------------------------------------------------
def _me(principal: Principal) -> int:
    if principal.user_id is None:
        raise HTTPException(status_code=400, detail="This endpoint requires a signed-in user.")
    return principal.user_id


@app.get("/users/me")
def get_me(principal: Principal = Depends(get_principal)):
    user = db.get_user_public(principal.tenant_id, _me(principal))
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@app.put("/users/me/preferences")
def update_my_preferences(payload: PreferencesUpdate, principal: Principal = Depends(get_principal)):
    return update_preferences(_me(principal), payload, principal)


@app.post("/users/me/consent")
def set_consent(payload: ConsentRequest, principal: Principal = Depends(get_principal)):
    user = db.record_location_consent(principal.tenant_id, _me(principal), payload.location)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@app.delete("/users/me", status_code=200)
def delete_me(principal: Principal = Depends(get_principal)):
    """Permanently delete the account and everything hanging off it
    (interactions, itineraries + items, notifications, tokens) via FK cascade."""
    uid = _me(principal)
    if not db.delete_user(principal.tenant_id, uid):
        raise HTTPException(status_code=404, detail="user not found")
    publish("user.deleted", {"tenant_id": principal.tenant_id, "user_id": uid})
    return {"deleted": True}


@app.post("/users", status_code=201)
def create_user(payload: UserCreate, principal: Principal = Depends(get_principal)):
    # Creating arbitrary users is a tenant-level (API key) operation, not something an end user may do.
    if principal.user_id is not None:
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        user = db.create_user(
            principal.tenant_id, payload.name, payload.email, payload.budget_min, payload.budget_max,
            payload.preferred_categories, payload.ambience_preferences,
            payload.home_lat, payload.home_lng, payload.age_group,
            payload.preferred_distance_km, payload.preferred_outing_type,
            payload.preferred_occasions, payload.preferred_duration
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not create user: {e}")
    publish("user.updated", {"tenant_id": principal.tenant_id, "user_id": user["id"], "reason": "created"})
    return user


@app.get("/users")
def list_users(principal: Principal = Depends(get_principal)):
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    return db.list_users(principal.tenant_id)


@app.get("/users/{user_id}")
def get_user(user_id: int, principal: Principal = Depends(get_principal)):
    require_self_or_admin(principal, user_id)
    user = db.get_user(principal.tenant_id, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@app.put("/users/{user_id}/preferences")
def update_preferences(user_id: int, payload: PreferencesUpdate, principal: Principal = Depends(get_principal)):
    require_self_or_admin(principal, user_id)
    user = db.update_preferences(
        principal.tenant_id, user_id, payload.budget_min, payload.budget_max,
        payload.preferred_categories, payload.ambience_preferences,
        payload.preferred_distance_km, payload.preferred_outing_type,
        payload.preferred_occasions, payload.preferred_duration
    )
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    publish("user.updated", {"tenant_id": principal.tenant_id, "user_id": user_id, "reason": "preferences_updated"})
    return user
