"""
Minimal Postgres helpers with RLS tenant scoping.

<<<<<<< HEAD
`tenant_cursor` opens a real transaction and sets `app.tenant_id` with
`set_config(..., is_local := true)`, so the setting disappears automatically on
COMMIT/ROLLBACK. A pooled connection can therefore never carry one tenant's id
into another tenant's request (the previous version used a session-level
setting on an autocommit connection, which leaked across pool checkouts).

The RLS policies in postgres/init/01-schema.sql cast with
NULLIF(current_setting('app.tenant_id', true), '')::uuid, so a missing or empty
setting yields NULL (no rows) instead of an exception.
=======
Sets `app.tenant_id` on each connection so FORCE ROW LEVEL SECURITY policies
in init.sql isolate rows. Pool is process-wide and created lazily.
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

<<<<<<< HEAD
# No default: a service that is missing its DB credentials must fail loudly
# rather than silently fall back to a well-known password.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
=======
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://app_role:app_role_pw@postgres:5432/outing"
)
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
<<<<<<< HEAD
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=int(os.environ.get("DB_POOL_MAX", "10")),
            kwargs={"row_factory": dict_row},  # autocommit OFF: we manage transactions
            open=True,
=======
        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row, "autocommit": True},
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        )
    return _pool


@contextmanager
def tenant_cursor(tenant_id: str) -> Iterator:
<<<<<<< HEAD
    """Yield a cursor inside a transaction scoped to `tenant_id`.

    Commits on normal exit, rolls back on exception. Consume results (fetchone /
    fetchall) inside the `with` block.
    """
    pool = get_pool()
    with pool.connection() as conn:  # commits/rolls back the transaction on exit
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, true)", (str(tenant_id),))
=======
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, false)", (tenant_id,))
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            yield cur
