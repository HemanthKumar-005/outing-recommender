<<<<<<< HEAD
"""Platform-schema helpers (tenant registry) used by api-gateway and workers.

API keys are stored only as SHA-256 hashes (+ a short display prefix). The full
key is returned exactly once, at creation or rotation.
"""
=======
"""Platform-schema helpers (tenant registry) used by api-gateway."""
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
from __future__ import annotations

import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

<<<<<<< HEAD
from security import generate_api_key, hash_api_key  # type: ignore

PLATFORM_DATABASE_URL = os.environ.get("PLATFORM_DATABASE_URL", "")
=======
PLATFORM_DATABASE_URL = os.environ.get(
    "PLATFORM_DATABASE_URL",
    "postgresql://gateway_role:gateway_role_pw@postgres:5432/outing",
)
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

_pool: ConnectionPool | None = None


def _pool_get() -> ConnectionPool:
    global _pool
    if _pool is None:
<<<<<<< HEAD
        if not PLATFORM_DATABASE_URL:
            raise RuntimeError("PLATFORM_DATABASE_URL is not set")
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        _pool = ConnectionPool(
            conninfo=PLATFORM_DATABASE_URL,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row, "autocommit": True},
        )
    return _pool


def resolve_tenant_by_api_key(api_key: str) -> dict | None:
<<<<<<< HEAD
    """Return the tenant for a presented key, or None if unknown or revoked."""
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, is_consumer FROM platform.tenants
                   WHERE api_key_hash = %s AND revoked_at IS NULL""",
                (hash_api_key(api_key),),
            )
            row = cur.fetchone()
            # The consumer tenant is reachable only through user sessions, never via an API key.
            if not row or row["is_consumer"]:
                return None
            return {"id": row["id"], "name": row["name"]}


def create_tenant(name: str) -> dict:
    """Create a tenant. Returns the plaintext key ONCE; only its hash is persisted."""
    full, key_hash, prefix = generate_api_key()
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO platform.tenants (name, api_key_hash, api_key_prefix)
                   VALUES (%s, %s, %s) RETURNING id, name, api_key_prefix""",
                (name, key_hash, prefix),
            )
            row = cur.fetchone()
            return {"id": row["id"], "name": row["name"], "api_key": full, "api_key_prefix": row["api_key_prefix"]}


def rotate_api_key(tenant_id: str) -> dict | None:
    """Issue a new key for the tenant; the old key stops working immediately.
    Returns {api_key, api_key_prefix, old_key_hash} so callers can purge caches."""
    full, key_hash, prefix = generate_api_key()
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT api_key_hash FROM platform.tenants WHERE id = %s AND revoked_at IS NULL AND NOT is_consumer", (tenant_id,))
            old = cur.fetchone()
            if not old:
                return None
            cur.execute(
                "UPDATE platform.tenants SET api_key_hash = %s, api_key_prefix = %s WHERE id = %s",
                (key_hash, prefix, tenant_id),
            )
            return {"api_key": full, "api_key_prefix": prefix, "old_key_hash": old["api_key_hash"]}


def revoke_tenant(tenant_id: str) -> str | None:
    """Revoke the tenant's key. Returns the revoked key hash (for cache purge) or None."""
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE platform.tenants SET revoked_at = now()
                   WHERE id = %s AND revoked_at IS NULL AND NOT is_consumer
                   RETURNING api_key_hash""",
                (tenant_id,),
            )
            row = cur.fetchone()
            return row["api_key_hash"] if row else None


def get_consumer_tenant_id() -> str | None:
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM platform.tenants WHERE is_consumer AND revoked_at IS NULL")
            row = cur.fetchone()
            return str(row["id"]) if row else None


def list_tenant_ids() -> list[str]:
    """Return all active tenant IDs (used by background sweeps; worker_role is SELECT-only)."""
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM platform.tenants WHERE revoked_at IS NULL ORDER BY id")
            return [str(row["id"]) for row in cur.fetchall()]
=======
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


def list_tenant_ids() -> list[str]:
    """Return all tenant IDs from the platform registry.

    Used by background workers (e.g. sentiment-worker) that need to sweep
    every tenant on startup.  Runs as worker_role which only has SELECT on
    platform.tenants.
    """
    with _pool_get().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM platform.tenants ORDER BY id")
            return [str(row["id"]) for row in cur.fetchall()]

>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
