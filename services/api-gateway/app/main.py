"""API gateway: the only publicly exposed backend.

Responsibilities
  * Real user authentication (Argon2id passwords, signed JWT in an HttpOnly cookie)
  * Tenant API-key authentication for B2B callers (keys stored hashed, rotatable)
  * Identity propagation: strips client-supplied identity headers and forwards
    X-Tenant-Id / X-User-Id / X-User-Role to internal services
  * Rate limiting (fail-closed on auth endpoints), CSRF origin checks, captcha
  * Clean 502/504 JSON errors when an upstream is down
"""
import logging
import os
import sys
import time

import httpx
# pyrefly: ignore [missing-import]
import redis
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from starlette.concurrency import run_in_threadpool

sys.path.insert(0, "/shared")
# pyrefly: ignore [missing-import]
from authctx import ROLE_HEADER, USER_HEADER  # noqa: E402
# pyrefly: ignore [missing-import]
from mailer import send_email, smtp_configured  # noqa: E402
# pyrefly: ignore [missing-import]
from observability import propagate_headers, setup_observability  # noqa: E402
# pyrefly: ignore [missing-import]
from pgdb_platform import (  # noqa: E402
    create_tenant, get_consumer_tenant_id, resolve_tenant_by_api_key, revoke_tenant, rotate_api_key,
)
# pyrefly: ignore [missing-import]
from security import SESSION_COOKIE, SESSION_TTL_SECONDS, decode_session_token, hash_api_key, mint_session_token  # noqa: E402
# pyrefly: ignore [missing-import]
from tenant import TENANT_HEADER  # noqa: E402

app = FastAPI(title="API Gateway")
setup_observability(app, "api-gateway")
log = logging.getLogger("api-gateway")

APP_ENV = os.environ.get("APP_ENV", "development")
IS_PROD = APP_ENV == "production"
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:3000").rstrip("/")
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
REQUIRE_EMAIL_VERIFICATION = os.environ.get("REQUIRE_EMAIL_VERIFICATION", "true" if IS_PROD else "false").lower() == "true"
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "false").lower() == "true"  # true behind our nginx
MAX_TENANTS = int(os.environ.get("MAX_TENANTS", "100"))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true" if IS_PROD else "false").lower() == "true"

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
)

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "120"))
AUTH_RATE_LIMIT_PER_HOUR = int(os.environ.get("AUTH_RATE_LIMIT_PER_HOUR", "20"))
CACHE_TTL_SECONDS = 15
API_KEY_CACHE_TTL_SECONDS = 30

ROUTES = {
    "users": os.environ.get("USER_SERVICE_URL", "http://user-service:8000"),
    "places": os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000"),
    "context": os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000"),
    "interactions": os.environ.get("INTERACTION_SERVICE_URL", "http://interaction-service:8000"),
    "recommendations": os.environ.get("RECOMMENDATION_ENGINE_URL", "http://recommendation-engine:8000"),
    "itinerary": os.environ.get("ITINERARY_SERVICE_URL", "http://itinerary-service:8000"),
    "notifications": os.environ.get("NOTIFICATION_SERVICE_URL", "http://notification-service:8000"),
}
USER_SERVICE = ROUTES["users"]

# Public, unauthenticated GET endpoints (read-only reference data / shared itineraries).
PUBLIC_PATHS = (
    ("places", "occasions"),
    ("places", "locations"),
    ("itinerary", "occasions"),
    ("recommendations", "model-card"),  # public transparency page
    ("itinerary", "shared"),  # read-only shared itineraries (unguessable token)
)
CACHEABLE_PREFIXES = ("places",)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

_client = httpx.AsyncClient(timeout=10.0)
_redis = redis.from_url(REDIS_URL, decode_responses=True)


# ------------------------------------------------------------------ helpers
def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(identity: str, limit: int, window_seconds: int, fail_closed: bool) -> bool:
    """Fixed-window counter in Redis. Returns True when the request is allowed.
    On Redis failure: fail CLOSED for sensitive endpoints, open for ordinary traffic."""
    key = f"ratelimit:{identity}:{int(time.time() // window_seconds)}"
    try:
        count = _redis.incr(key)
        if count == 1:
            _redis.expire(key, window_seconds)
        return count <= limit
    except Exception as e:  # noqa: BLE001
        log.error("rate limiter unavailable (%s): %s", "closed" if fail_closed else "open", e)
        return not fail_closed


def _json_error(status: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail})


async def _verify_captcha(token: str | None, ip: str) -> bool:
    """Cloudflare Turnstile (free, no card). Required whenever a secret is configured;
    in production a missing secret is treated as a misconfiguration, not a bypass."""
    if not TURNSTILE_SECRET_KEY:
        return not IS_PROD
    if not token:
        return False
    try:
        r = await _client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": TURNSTILE_SECRET_KEY, "response": token, "remoteip": ip},
            timeout=5.0,
        )
        return bool(r.json().get("success"))
    except Exception as e:  # noqa: BLE001
        log.error("turnstile verification failed: %s", e)
        return False


def _internal_headers(tenant_id: str) -> dict:
    return propagate_headers({TENANT_HEADER: tenant_id, "X-Internal-Token": INTERNAL_SERVICE_TOKEN, "Content-Type": "application/json"})


async def _user_service(method: str, path: str, tenant_id: str, json_body: dict | None = None) -> httpx.Response:
    try:
        return await _client.request(method, f"{USER_SERVICE}{path}", json=json_body, headers=_internal_headers(tenant_id))
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail="user service timed out") from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail="user service unavailable") from e


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_TTL_SECONDS, httponly=True,
        secure=COOKIE_SECURE, samesite="lax", path="/",
    )


def _consumer_tenant() -> str:
    tid = get_consumer_tenant_id()
    if not tid:
        raise HTTPException(status_code=503, detail="platform is not initialised (no consumer tenant)")
    return tid


# ------------------------------------------------------------------- health
@app.get("/health")
def health():
    return {"status": "ok", "service": "api-gateway", "routes": list(ROUTES.keys())}


@app.get("/ready")
def ready():
    """Readiness: Redis and the platform DB must both be reachable."""
    problems = {}
    try:
        _redis.ping()
    except Exception as e:  # noqa: BLE001
        problems["redis"] = str(e)
    try:
        get_consumer_tenant_id()
    except Exception as e:  # noqa: BLE001
        problems["database"] = str(e)
    if problems:
        return JSONResponse(status_code=503, content={"status": "not_ready", "problems": problems})
    return {"status": "ready", "redis": "ok", "database": "ok"}


# --------------------------------------------------------------------- auth
class SignupBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    accept_terms: bool
    captcha_token: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    captcha_token: str | None = None


class VerifyBody(BaseModel):
    token: str = Field(min_length=10, max_length=200)


def _send_verification(email: str, name: str, token: str) -> None:
    link = f"{PUBLIC_BASE_URL}/verify-email?token={token}"
    send_email(
        email, "Confirm your Nearby & Co. account",
        f"Hi {name},\n\nConfirm your email to finish creating your account:\n{link}\n\n"
        "This link expires in 24 hours. If you didn't sign up, you can ignore this email.\n",
    )


@app.post("/auth/signup", status_code=202)
async def auth_signup(body: SignupBody, request: Request):
    ip = _client_ip(request)
    if not await run_in_threadpool(_rate_limit, f"signup:{ip}", AUTH_RATE_LIMIT_PER_HOUR, 3600, True):
        return _json_error(429, "Too many attempts. Please try again later.")
    if not await _verify_captcha(body.captcha_token, ip):
        return _json_error(400, "Captcha verification failed.")
    if REQUIRE_EMAIL_VERIFICATION and not smtp_configured():
        return _json_error(503, "Email delivery is not configured on this server.")
    tenant_id = await run_in_threadpool(_consumer_tenant)
    r = await _user_service("POST", "/internal/auth/register", tenant_id, {
        "name": body.name, "email": body.email, "password": body.password,
        "accept_terms": body.accept_terms, "require_verification": REQUIRE_EMAIL_VERIFICATION,
    })
    if r.status_code == 400:
        return _json_error(400, r.json().get("detail", "Invalid signup details."))
    if r.status_code >= 500 or r.status_code == 403:
        return _json_error(502, "Could not create account right now.")
    data = r.json()
    if data.get("created") and REQUIRE_EMAIL_VERIFICATION:
        await run_in_threadpool(_send_verification, body.email, body.name, data["verification_token"])
    elif data.get("created") and not smtp_configured():
        log.warning("new signup created (email verification disabled)")  # never log the address itself
    # Identical response whether or not the email already existed (no account enumeration).
    return {"status": "accepted", "verification_required": REQUIRE_EMAIL_VERIFICATION}


@app.post("/auth/login")
async def auth_login(body: LoginBody, request: Request):
    ip = _client_ip(request)
    # Per-IP and per-account throttles; both fail closed if Redis is down.
    if not await run_in_threadpool(_rate_limit, f"login-ip:{ip}", 30, 600, True) or \
       not await run_in_threadpool(_rate_limit, f"login-acct:{body.email.lower()}", 10, 600, True):
        return _json_error(429, "Too many login attempts. Please wait a few minutes.")
    if not await _verify_captcha(body.captcha_token, ip):
        return _json_error(400, "Captcha verification failed.")
    tenant_id = await run_in_threadpool(_consumer_tenant)
    r = await _user_service("POST", "/internal/auth/verify-credentials", tenant_id,
                            {"email": body.email, "password": body.password})
    if r.status_code == 401:
        return _json_error(401, "Invalid email or password.")
    if r.status_code != 200:
        return _json_error(502, "Could not sign in right now.")
    user = r.json()["user"]
    if REQUIRE_EMAIL_VERIFICATION and not user.get("email_verified_at"):
        return _json_error(403, "Please confirm your email address first. Check your inbox for the link.")
    token = mint_session_token(user["id"], tenant_id, user.get("role", "user"))
    resp = JSONResponse({"user": user})
    _set_session_cookie(resp, token)
    return resp


@app.post("/auth/logout")
def auth_logout():
    resp = JSONResponse({"status": "signed_out"})
    resp.delete_cookie(SESSION_COOKIE, path="/")
    return resp


@app.post("/auth/verify-email")
async def auth_verify_email(body: VerifyBody, request: Request):
    ip = _client_ip(request)
    if not await run_in_threadpool(_rate_limit, f"verify:{ip}", 30, 3600, True):
        return _json_error(429, "Too many attempts.")
    tenant_id = await run_in_threadpool(_consumer_tenant)
    r = await _user_service("POST", "/internal/auth/verify-email", tenant_id, {"token": body.token})
    if r.status_code == 400:
        return _json_error(400, r.json().get("detail", "Invalid or expired link."))
    if r.status_code != 200:
        return _json_error(502, "Could not verify right now.")
    user = r.json()["user"]
    resp = JSONResponse({"status": "verified", "user": user})
    _set_session_cookie(resp, mint_session_token(user["id"], tenant_id, user.get("role", "user")))
    return resp


@app.post("/auth/resend-verification", status_code=202)
async def auth_resend(body: LoginBody, request: Request):
    ip = _client_ip(request)
    if not await run_in_threadpool(_rate_limit, f"resend:{ip}", 5, 3600, True):
        return _json_error(429, "Too many attempts.")
    if not await _verify_captcha(body.captcha_token, ip):
        return _json_error(400, "Captcha verification failed.")
    tenant_id = await run_in_threadpool(_consumer_tenant)
    r = await _user_service("POST", "/internal/auth/resend-verification", tenant_id,
                            {"email": body.email, "password": body.password})
    if r.status_code == 200 and r.json().get("sent"):
        d = r.json()
        await run_in_threadpool(_send_verification, d["email"], d["name"], d["verification_token"])
    return {"status": "accepted"}


def _principal_from_request(request: Request) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    return decode_session_token(token) if token else None


@app.get("/auth/me")
async def auth_me(request: Request):
    claims = _principal_from_request(request)
    if not claims:
        return _json_error(401, "not authenticated")
    try:
        r = await _client.get(
            f"{USER_SERVICE}/users/me",
            headers=propagate_headers({TENANT_HEADER: claims["tid"], USER_HEADER: claims["sub"], ROLE_HEADER: claims.get("role", "user")}),
        )
    except httpx.HTTPError:
        return _json_error(502, "user service unavailable")
    if r.status_code == 404:
        return _json_error(401, "not authenticated")  # account deleted
    if r.status_code != 200:
        return _json_error(502, "could not load profile")
    return {"user": r.json()}


# ------------------------------------------------- tenant (B2B) management
class TenantSignup(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    captcha_token: str | None = None


@app.post("/tenants", status_code=201)
async def signup_tenant(payload: TenantSignup, request: Request):
    """Self-serve B2B tenant provisioning. Protected by captcha, per-IP rate limits
    and a hard cap on the total number of tenants (prevents tenant exhaustion).
    The API key is shown ONCE; only its SHA-256 hash is stored."""
    ip = _client_ip(request)
    if not await run_in_threadpool(_rate_limit, f"tenant-signup:{ip}", 3, 3600, True):
        return _json_error(429, "Too many attempts. Please try again later.")
    if not await _verify_captcha(payload.captcha_token, ip):
        return _json_error(400, "Captcha verification failed.")
    from pgdb_platform import list_tenant_ids  # noqa: E402
    if len(await run_in_threadpool(list_tenant_ids)) >= MAX_TENANTS:
        return _json_error(503, "Tenant capacity reached. Please contact the operator.")
    tenant = await run_in_threadpool(create_tenant, payload.name.strip())
    return {"tenant_id": str(tenant["id"]), "name": tenant["name"], "api_key": tenant["api_key"],
            "api_key_prefix": tenant["api_key_prefix"],
            "note": "Store this key now. It cannot be shown again."}


def _purge_key_cache(key_hash: str) -> None:
    try:
        _redis.delete(f"apikey:{key_hash}")
    except Exception as e:  # noqa: BLE001
        log.error("could not purge api key cache: %s", e)


@app.post("/tenant/api-key/rotate")
async def rotate_key(request: Request):
    """Authenticated with the tenant's CURRENT key; returns a new one and kills the old one at once."""
    key = request.headers.get("x-api-key", "")
    tenant_id = await run_in_threadpool(_resolve_tenant, key) if key else None
    if not tenant_id:
        return _json_error(401, "invalid X-API-Key")
    result = await run_in_threadpool(rotate_api_key, tenant_id)
    if not result:
        return _json_error(404, "tenant not found")
    await run_in_threadpool(_purge_key_cache, result["old_key_hash"])
    return {"api_key": result["api_key"], "api_key_prefix": result["api_key_prefix"],
            "note": "The previous key no longer works."}


@app.post("/tenant/api-key/revoke")
async def revoke_key(request: Request):
    key = request.headers.get("x-api-key", "")
    tenant_id = await run_in_threadpool(_resolve_tenant, key) if key else None
    if not tenant_id:
        return _json_error(401, "invalid X-API-Key")
    key_hash = await run_in_threadpool(revoke_tenant, tenant_id)
    if key_hash:
        await run_in_threadpool(_purge_key_cache, key_hash)
    return {"status": "revoked"}


def _resolve_tenant(api_key: str) -> str | None:
    key_hash = hash_api_key(api_key)
    cache_key = f"apikey:{key_hash}"
    try:
        cached = _redis.get(cache_key)
        if cached:
            return cached
    except Exception as e:  # noqa: BLE001
        log.warning("tenant cache read failed: %s", e)
    tenant = resolve_tenant_by_api_key(api_key)
    if not tenant:
        return None
    tenant_id = str(tenant["id"])
    try:
        _redis.setex(cache_key, API_KEY_CACHE_TTL_SECONDS, tenant_id)
    except Exception as e:  # noqa: BLE001
        log.warning("tenant cache write failed: %s", e)
    return tenant_id


# -------------------------------------------------------------------- proxy
@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(service: str, path: str, request: Request):
    if service not in ROUTES:
        return _json_error(404, f"unknown service '{service}'")

    user_id: str | None = None
    role = "user"
    tenant_id: str | None = None
    via_cookie = False

    # 1) End-user session (cookie or bearer JWT) -> tenant + user identity from the signed token.
    claims = _principal_from_request(request)
    if claims:
        tenant_id, user_id, role = claims["tid"], claims["sub"], claims.get("role", "user")
        via_cookie = request.cookies.get(SESSION_COOKIE) is not None
    else:
        # 2) Tenant API key (B2B / server-to-server): tenant-level access, no end-user identity.
        api_key = request.headers.get("x-api-key")
        if api_key:
            tenant_id = await run_in_threadpool(_resolve_tenant, api_key)
            if not tenant_id:
                return _json_error(401, "invalid X-API-Key")

    if not tenant_id:
        # Unauthenticated: only a tiny allow-list of public reference data, served for the consumer tenant.
        if request.method == "GET" and (service, path.split("/")[0]) in PUBLIC_PATHS:
            tenant_id = await run_in_threadpool(_consumer_tenant)
        else:
            return _json_error(401, "authentication required")

    # CSRF defence for cookie-authenticated state-changing requests: Origin must be ours.
    if via_cookie and request.method not in SAFE_METHODS:
        origin = request.headers.get("origin", "")
        if origin not in CORS_ORIGINS:
            return _json_error(403, "cross-origin request blocked")

    # Rate-limit per tenant and per user so one caller can't starve others.
    identity = f"{tenant_id}:{user_id}" if user_id else tenant_id
    if not await run_in_threadpool(_rate_limit, identity, RATE_LIMIT_PER_MINUTE, 60, False):
        return _json_error(429, "rate limit exceeded")

    target_url = f"{ROUTES[service]}/{path}"
    cache_key = f"cache:{tenant_id}:{request.method}:{target_url}:{request.url.query}"

    if request.method == "GET" and service in CACHEABLE_PREFIXES:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return Response(content=cached, media_type="application/json", headers={"X-Cache": "HIT"})
        except Exception as e:  # noqa: BLE001
            log.warning("cache read failed: %s", e)

    # Build upstream headers from scratch: NEVER copy client-supplied identity headers.
    headers = propagate_headers({
        "content-type": request.headers.get("content-type", "application/json"),
        TENANT_HEADER: tenant_id,
    })
    if user_id:
        headers[USER_HEADER] = user_id
        headers[ROLE_HEADER] = role

    body = await request.body()
    try:
        upstream = await _client.request(
            request.method, target_url, params=dict(request.query_params), content=body, headers=headers,
        )
    except httpx.TimeoutException:
        return _json_error(504, f"{service} timed out")
    except httpx.HTTPError as e:
        log.error("upstream %s unavailable: %s", service, e)
        return _json_error(502, f"{service} is unavailable")

    if request.method == "GET" and service in CACHEABLE_PREFIXES and upstream.status_code == 200:
        try:
            _redis.setex(cache_key, CACHE_TTL_SECONDS, upstream.content)
        except Exception as e:  # noqa: BLE001
            log.warning("cache write failed: %s", e)

    passthrough = {}
    if "content-disposition" in upstream.headers:  # e.g. .ics calendar downloads
        passthrough["Content-Disposition"] = upstream.headers["content-disposition"]
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type", "application/json"),
        headers=passthrough,
    )
