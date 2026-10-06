"""
Minimal Postgres helpers with RLS tenant scoping.

Sets `app.tenant_id` on each connection so FORCE ROW LEVEL SECURITY policies
in init.sql isolate rows. Pool is process-wide and created lazily.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://app_role:app_role_pw@postgres:5432/outing"
)

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row, "autocommit": True},
        )
    return _pool


@contextmanager
def tenant_cursor(tenant_id: str) -> Iterator:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, false)", (tenant_id,))
            yield cur
