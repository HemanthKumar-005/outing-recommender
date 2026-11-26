import hashlib
import os
import secrets
import sys
import time

import httpx
import redis
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pydantic import BaseModel

sys.path.insert(0, "/shared")
from pgdb_platform import (  # noqa: E402
    create_tenant,
    resolve_tenant_by_api_key,
    revoke_tenant_key,
    rotate_tenant_key,
)
from tenant import TENANT_HEADER, USER_HEADER  # noqa: E402

try:
    from shared.logging_config import configure_logging, request_id_var
    from shared.request_id_middleware import RequestIdMiddleware
    from shared.sentry_config import init_sentry
except ImportError:
    from logging_config import configure_logging, request_id_var
    from request_id_middleware import RequestIdMiddleware
    from sentry_config import init_sentry

init_sentry("api-gateway")
logger = configure_logging("api-gateway")

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

app = FastAPI(title="API Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "120"))
CACHE_TTL_SECONDS = 15
API_KEY_CACHE_TTL_SECONDS = 30  # tenant resolution is cached briefly to avoid a DB round trip per request

ROUTES = {
    "users": os.environ.get("USER_SERVICE_URL", "http://user-service:8000"),
    "places": os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000"),
    "context": os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000"),
    "interactions": os.environ.get("INTERACTION_SERVICE_URL", "http://interaction-service:8000"),
    "recommendations": os.environ.get("RECOMMENDATION_ENGINE_URL", "http://recommendation-engine:8000"),
    "itinerary": os.environ.get("ITINERARY_SERVICE_URL", "http://itinerary-service:8000"),
    "notifications": os.environ.get("NOTIFICATION_SERVICE_URL", "http://notification-service:8000"),
}

CACHEABLE_PREFIXES = ("places",)  # GET responses under these prefixes get a short cache

_client = httpx.AsyncClient(timeout=10.0)
_redis = redis.from_url(REDIS_URL, decode_responses=True)


class TenantSignup(BaseModel):
    name: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "api-gateway", "routes": list(ROUTES.keys())}


@app.get("/ready")
def ready():
    try:
        _redis.ping()
        return {"status": "ready", "redis": "ok"}
    except Exception as e:  # noqa: BLE001
        return {"status": "ready", "redis": f"unavailable ({e}), continuing without cache/rate-limit"}


def _hash_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_signup_rate_limit(ip: str) -> tuple[bool, int | None]:
    """Checks per-IP signup rate limit (5 requests per hour).
    Returns (allowed, status_code_if_denied).
    Fails closed (returns False, 503) if Redis is unreachable.
    """
    hour_window = int(time.time() // 3600)
    key = f"ratelimit:signup:{ip}:{hour_window}"
    try:
        count = _redis.incr(key)
        if count == 1:
            _redis.expire(key, 3600)
        if count > 5:
            return False, 429
        return True, None
    except Exception as e:  # noqa: BLE001
        logger.error(f"signup rate limit check failed: {e}", exc_info=True)
        # Fail closed on auth endpoints: an unavailable Redis must not become
        # a free pass for unlimited login or signup attempts.
        return False, 503


@app.post("/tenants", status_code=201)
def signup(payload: TenantSignup, request: Request):
    """Self-serve tenant provisioning: creates a new tenant and returns its
    API key. Every request against this key is isolated from every other
    tenant's data by Postgres row-level security - see postgres/init.sql."""
    client_ip = _get_client_ip(request)
    allowed, status_code = _check_signup_rate_limit(client_ip)
    if not allowed:
        if status_code == 429:
            return JSONResponse(status_code=429, content={"detail": "Too many signup attempts. Try again later."})
        return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable. Please try again later."})

    api_key = secrets.token_urlsafe(24)
    key_hash = _hash_key(api_key)
    key_prefix = api_key[:8]
    tenant = create_tenant(payload.name, key_hash, key_prefix)
    return {
        "tenant_id": str(tenant["id"]),
        "name": tenant["name"],
        "api_key": api_key,
        "key_prefix": key_prefix,
    }


@app.post("/tenants/rotate-key")
def rotate_key(request: Request):
    current_key = request.headers.get("x-api-key")
    if not current_key:
        return JSONResponse(status_code=401, content={"detail": "missing X-API-Key"})

    current_hash = _hash_key(current_key)
    tenant_id = _resolve_tenant(current_key)
    if not tenant_id:
        return JSONResponse(status_code=401, content={"detail": "invalid X-API-Key"})

    new_key = secrets.token_urlsafe(24)
    new_hash = _hash_key(new_key)
    new_prefix = new_key[:8]

    tenant = rotate_tenant_key(current_hash, new_hash, new_prefix)
    if not tenant:
        return JSONResponse(status_code=404, content={"detail": "tenant not found"})

    # Immediately delete the old key's Redis cache entry
    try:
        _redis.delete(f"apikey:{current_hash}")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"failed to delete old key from cache: {e}")

    return {"api_key": new_key, "key_prefix": new_prefix}


@app.delete("/tenants/key")
def revoke_key(request: Request):
    current_key = request.headers.get("x-api-key")
    if not current_key:
        return JSONResponse(status_code=401, content={"detail": "missing X-API-Key"})

    current_hash = _hash_key(current_key)
    tenant_id = _resolve_tenant(current_key)
    if not tenant_id:
        return JSONResponse(status_code=401, content={"detail": "invalid X-API-Key"})

    success = revoke_tenant_key(current_hash)
    if not success:
        return JSONResponse(status_code=404, content={"detail": "tenant not found"})

    # Delete the Redis cache entry for the old key
    try:
        _redis.delete(f"apikey:{current_hash}")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"failed to delete old key from cache: {e}")

    return {"revoked": True}


def _resolve_tenant(api_key: str) -> str | None:
    key_hash = _hash_key(api_key)
    cache_key = f"apikey:{key_hash}"
    try:
        cached = _redis.get(cache_key)
        if cached:
            return cached
    except Exception as e:  # noqa: BLE001
        logger.warning(f"tenant cache read failed: {e}")

    tenant = resolve_tenant_by_api_key(key_hash)
    if not tenant:
        return None
    tenant_id = str(tenant["id"])
    try:
        _redis.setex(cache_key, API_KEY_CACHE_TTL_SECONDS, tenant_id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"tenant cache write failed: {e}")
    return tenant_id


def _rate_limit_key(identity: str) -> str:
    window = int(time.time() // 60)
    return f"ratelimit:{identity}:{window}"


def _check_rate_limit(identity: str, is_auth: bool = False) -> bool:
    key = _rate_limit_key(identity)
    try:
        count = _redis.incr(key)
        if count == 1:
            _redis.expire(key, 60)
        return count <= RATE_LIMIT_PER_MINUTE
    except Exception as e:  # noqa: BLE001
        logger.error(f"rate limit check failed: {e}", exc_info=True)
        # Fail closed on auth endpoints: an unavailable Redis must not become
        # a free pass for unlimited login or signup attempts.
        if is_auth:
            return False
        return True


@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(service: str, path: str, request: Request):
    if service not in ROUTES:
        return JSONResponse(status_code=404, content={"detail": f"unknown service '{service}'"})

    api_key = request.headers.get("x-api-key")
    if not api_key:
        if service == "recommendations" and path.strip("/") in ("model-card", "model-info"):
            api_key = "demo-key"
        else:
            return JSONResponse(status_code=401, content={"detail": "missing X-API-Key"})
    tenant_id = _resolve_tenant(api_key)
    if not tenant_id:
        return JSONResponse(status_code=401, content={"detail": "invalid X-API-Key"})

    # Check whether this request targets an auth endpoint (e.g. login)
    is_auth_endpoint = (
        request.method == "POST"
        and service == "users"
        and path.strip("/") in ("users/login", "login")
    )

    # Rate-limit per tenant, not per IP, so one tenant's traffic can't starve another's.
    if not _check_rate_limit(tenant_id, is_auth=is_auth_endpoint):
        return JSONResponse(status_code=429, content={"detail": "rate limit exceeded"})

    # JWT verification on all /api/* routes except registration and login endpoints,
    # and public model information/transparency endpoints
    is_auth_exempt = (
        (
            request.method == "POST"
            and service == "users"
            and path.strip("/") in ("users/register", "register", "users/login", "login")
        )
        or (
            request.method == "GET"
            and service == "recommendations"
            and path.strip("/") in ("model-card", "model-info")
        )
    )

    user_id = None
    if not is_auth_exempt:
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "missing or invalid authorization token"})
        token = auth_header.split(" ", 1)[1].strip()
        try:
            token_payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = token_payload.get("user_id")
            token_tenant_id = token_payload.get("tenant_id")
            if not user_id:
                return JSONResponse(status_code=401, content={"detail": "invalid token payload: missing user_id"})
            if token_tenant_id and str(token_tenant_id) != str(tenant_id):
                return JSONResponse(status_code=401, content={"detail": "token does not match tenant"})
        except Exception as e:
            return JSONResponse(status_code=401, content={"detail": f"invalid or expired token: {e}"})

    target_url = f"{ROUTES[service]}/{path}"
    cache_key = f"cache:{tenant_id}:{request.method}:{target_url}:{request.url.query}"

    if request.method == "GET" and service in CACHEABLE_PREFIXES:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return Response(content=cached, media_type="application/json", headers={"X-Cache": "HIT"})
        except Exception as e:  # noqa: BLE001
            logger.warning(f"cache read failed: {e}")

    body = await request.body()
    forward_headers = {
        "content-type": request.headers.get("content-type", "application/json"),
        TENANT_HEADER: tenant_id,
        "x-request-id": request_id_var.get(),
    }
    if user_id is not None:
        forward_headers[USER_HEADER] = str(user_id)

    try:
        upstream = await _client.request(
            request.method, target_url, params=dict(request.query_params),
            content=body,
            headers=forward_headers,
        )
    except httpx.TimeoutException:
        return JSONResponse(status_code=504, content={"detail": "upstream service timed out"})
    except httpx.ConnectError:
        return JSONResponse(status_code=502, content={"detail": "upstream service unavailable"})
    except Exception as e:  # noqa: BLE001
        logger.error(f"unexpected proxy error: {e}", exc_info=True)
        return JSONResponse(status_code=502, content={"detail": "upstream error"})

    if request.method == "GET" and service in CACHEABLE_PREFIXES and upstream.status_code == 200:
        try:
            _redis.setex(cache_key, CACHE_TTL_SECONDS, upstream.content)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"cache write failed: {e}")

    return Response(content=upstream.content, status_code=upstream.status_code, media_type="application/json")
