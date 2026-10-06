"""Platform-schema helpers (tenant registry) used by api-gateway."""
from __future__ import annotations

import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PLATFORM_DATABASE_URL = os.environ.get(
    "PLATFORM_DATABASE_URL",
    "postgresql://gateway_role:gateway_role_pw@postgres:5432/outing",
)

_pool: ConnectionPool | None = None


def _pool_get() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=PLATFORM_DATABASE_URL,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row, "autocommit": True},
        )
    return _pool


def resolve_tenant_by_api_key(api_key: str) -> dict | None:
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, api_key FROM platform.tenants WHERE api_key = %s",
                (api_key,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"id": row["id"], "name": row["name"], "api_key": row["api_key"]}


def create_tenant(name: str, api_key: str) -> dict:
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO platform.tenants (name, api_key)
                   VALUES (%s, %s) RETURNING id, name, api_key""",
                (name, api_key),
            )
            row = cur.fetchone()
            return {"id": row["id"], "name": row["name"], "api_key": row["api_key"]}
