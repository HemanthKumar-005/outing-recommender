import os
import secrets
import sys
import time

import httpx
import redis
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

sys.path.insert(0, "/shared")
from pgdb_platform import create_tenant, resolve_tenant_by_api_key  # noqa: E402
from tenant import TENANT_HEADER  # noqa: E402

app = FastAPI(title="API Gateway")

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


@app.post("/tenants", status_code=201)
def signup(payload: TenantSignup):
    """Self-serve tenant provisioning: creates a new tenant and returns its
    API key. Every request against this key is isolated from every other
    tenant's data by Postgres row-level security - see postgres/init.sql."""
    api_key = secrets.token_urlsafe(24)
    tenant = create_tenant(payload.name, api_key)
    return {"tenant_id": str(tenant["id"]), "name": tenant["name"], "api_key": tenant["api_key"]}


def _resolve_tenant(api_key: str) -> str | None:
    cache_key = f"apikey:{api_key}"
    try:
        cached = _redis.get(cache_key)
        if cached:
            return cached
    except Exception as e:  # noqa: BLE001
        print(f"[api-gateway] tenant cache read failed: {e}")

    tenant = resolve_tenant_by_api_key(api_key)
    if not tenant:
        return None
    tenant_id = str(tenant["id"])
    try:
        _redis.setex(cache_key, API_KEY_CACHE_TTL_SECONDS, tenant_id)
    except Exception as e:  # noqa: BLE001
        print(f"[api-gateway] tenant cache write failed: {e}")
    return tenant_id


def _rate_limit_key(identity: str) -> str:
    window = int(time.time() // 60)
    return f"ratelimit:{identity}:{window}"


def _check_rate_limit(identity: str) -> bool:
    key = _rate_limit_key(identity)
    try:
        count = _redis.incr(key)
        if count == 1:
            _redis.expire(key, 60)
        return count <= RATE_LIMIT_PER_MINUTE
    except Exception as e:  # noqa: BLE001
        print(f"[api-gateway] rate limit check failed open: {e}")
        return True


@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(service: str, path: str, request: Request):
    if service not in ROUTES:
        return JSONResponse(status_code=404, content={"detail": f"unknown service '{service}'"})

    api_key = request.headers.get("x-api-key")
    if not api_key:
        return JSONResponse(status_code=401, content={"detail": "missing X-API-Key"})
    tenant_id = _resolve_tenant(api_key)
    if not tenant_id:
        return JSONResponse(status_code=401, content={"detail": "invalid X-API-Key"})

    # Rate-limit per tenant, not per IP, so one tenant's traffic can't starve another's.
    if not _check_rate_limit(tenant_id):
        return JSONResponse(status_code=429, content={"detail": "rate limit exceeded"})

    target_url = f"{ROUTES[service]}/{path}"
    cache_key = f"cache:{tenant_id}:{request.method}:{target_url}:{request.url.query}"

    if request.method == "GET" and service in CACHEABLE_PREFIXES:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return Response(content=cached, media_type="application/json", headers={"X-Cache": "HIT"})
        except Exception as e:  # noqa: BLE001
            print(f"[api-gateway] cache read failed: {e}")

    body = await request.body()
    upstream = await _client.request(
        request.method, target_url, params=dict(request.query_params),
        content=body,
        headers={
            "content-type": request.headers.get("content-type", "application/json"),
            TENANT_HEADER: tenant_id,
        },
    )

    if request.method == "GET" and service in CACHEABLE_PREFIXES and upstream.status_code == 200:
        try:
            _redis.setex(cache_key, CACHE_TTL_SECONDS, upstream.content)
        except Exception as e:  # noqa: BLE001
            print(f"[api-gateway] cache write failed: {e}")

    return Response(content=upstream.content, status_code=upstream.status_code, media_type="application/json")
