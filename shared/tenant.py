"""
Tenant context propagation.

The API gateway resolves an X-Api-Key to a tenant_id once (against
platform.tenants) and forwards it downstream as X-Tenant-Id on every proxied
request. Internal service-to-service calls (recommendation-engine ->
place-service, itinerary-service -> place-service, etc.) must also carry this
header explicitly, since they bypass the gateway - see tenant_headers().

Every tenant-owned route depends on require_tenant so there is no code path
that can query a tenant-scoped table without a validated tenant_id.
"""
import uuid

from fastapi import Header, HTTPException

TENANT_HEADER = "X-Tenant-Id"


def require_tenant(x_tenant_id: str = Header(..., alias=TENANT_HEADER)) -> str:
    try:
        uuid.UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"invalid or missing {TENANT_HEADER} header")
    return x_tenant_id


def tenant_headers(tenant_id: str) -> dict:
    """Header dict to attach to an outgoing httpx call so the callee's
    require_tenant dependency is satisfied."""
    return {TENANT_HEADER: str(tenant_id)}
