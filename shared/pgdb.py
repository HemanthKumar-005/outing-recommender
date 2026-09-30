"""
Shared Postgres access layer for tenant-scoped services.

Row-Level Security does the actual isolation: every tenant-owned table has
`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` and a policy that
compares each row's tenant_id to the session variable `app.tenant_id`
(see postgres/init.sql). This module's only job is making sure that
session variable is always set, inside the same transaction as the query,
before any application code touches the database - so there is no code path
that can accidentally read/write another tenant's rows.

Services connect as `app_role`, a non-superuser, NOBYPASSRLS role that does
not own the tables it queries - both are required for Postgres to actually
enforce the policies (table owners and superusers bypass RLS by default).
"""
import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        _pool = ConnectionPool(dsn, min_size=1, max_size=10, open=True)
    return _pool


@contextmanager
def tenant_cursor(tenant_id: str):
    """Yields a dict-row cursor inside a transaction scoped to one tenant.
    Commits on clean exit, rolls back on exception (both handled by
    ConnectionPool.connection())."""
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT set_config('app.tenant_id', %s, true)", (str(tenant_id),))
            yield cur


@contextmanager
def system_cursor():
    """For queries that are not tenant-scoped (e.g. the platform.tenants
    registry, read by a separate, more restricted role - see pgdb_platform.py).
    Included here only for symmetry; most services should use tenant_cursor."""
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur
