"""
Access to platform.tenants, which is NOT row-level-security protected (it
has no tenant_id column - it *is* the tenant list). Callers connect with
either gateway_role (SELECT + INSERT, used by api-gateway to resolve an API
key and to provision new tenants) or worker_role (SELECT only, used by
background workers that need to sweep every tenant, e.g. sentiment-worker's
startup catalog scan and itinerary-service's reminder/weather loops).
Neither role has any grant on the tenant-owned schemas - that's app_role's
job, gated by RLS (see shared/pgdb.py).
"""
import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_platform_pool: ConnectionPool | None = None


def get_platform_pool() -> ConnectionPool:
    global _platform_pool
    if _platform_pool is None:
        dsn = os.environ["PLATFORM_DATABASE_URL"]
        _platform_pool = ConnectionPool(dsn, min_size=1, max_size=3, open=True)
    return _platform_pool


def list_tenants() -> list:
    with get_platform_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id, name, created_at FROM platform.tenants ORDER BY created_at")
            return cur.fetchall()


def list_tenant_ids() -> list:
    return [str(t["id"]) for t in list_tenants()]


def resolve_tenant_by_api_key(api_key: str) -> dict | None:
    with get_platform_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id, name FROM platform.tenants WHERE api_key = %s", (api_key,))
            return cur.fetchone()


def create_tenant(name: str, api_key: str) -> dict:
    with get_platform_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO platform.tenants (name, api_key) VALUES (%s, %s) RETURNING id, name, api_key, created_at",
                (name, api_key),
            )
            return cur.fetchone()
