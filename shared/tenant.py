"""Tenant header helpers shared by every tenant-scoped service."""
from fastapi import Header, HTTPException

TENANT_HEADER = "X-Tenant-Id"


def require_tenant(x_tenant_id: str | None = Header(None, alias=TENANT_HEADER)) -> str:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail=f"missing {TENANT_HEADER}")
    return x_tenant_id


def tenant_headers(tenant_id: str) -> dict:
    """Return an HTTP headers dict with the tenant ID set.

    Used by background workers (e.g. sentiment-worker) when making httpx
    requests to internal services on behalf of a specific tenant.
    """
    return {TENANT_HEADER: str(tenant_id)}
