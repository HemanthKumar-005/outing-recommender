"""Row-level-security and data-integrity tests against a REAL Postgres.

Run with the schema from postgres/init/ loaded and these variables set
(CI does this; see .github/workflows/ci.yml):

    TEST_ADMIN_URL   postgres superuser URL (used only to create fixtures)
    TEST_APP_URL     app_role URL           (what the services use)
    TEST_GATEWAY_URL gateway_role URL
    TEST_TRAINER_URL trainer_role URL
"""
import os
import uuid

import psycopg
import pytest
from psycopg import errors

ADMIN = os.environ.get("TEST_ADMIN_URL")
APP = os.environ.get("TEST_APP_URL")
GATEWAY = os.environ.get("TEST_GATEWAY_URL")
TRAINER = os.environ.get("TEST_TRAINER_URL")

pytestmark = pytest.mark.skipif(not (ADMIN and APP), reason="TEST_ADMIN_URL / TEST_APP_URL not set")


@pytest.fixture()
def two_tenants():
    with psycopg.connect(ADMIN, autocommit=True) as c:
        ids = []
        for n in ("A", "B"):
            tid = c.execute(
                "INSERT INTO platform.tenants (name, api_key_hash, api_key_prefix) VALUES (%s, %s, 'x') RETURNING id",
                (f"rls-{n}-{uuid.uuid4().hex[:6]}", uuid.uuid4().hex),
            ).fetchone()[0]
            ids.append(str(tid))
        yield ids
        for table in ("interactions.interactions", "itineraries.itineraries", "places.issue_reports",
                      "places.places", "users.email_tokens", "users.users"):
            c.execute(f"DELETE FROM {table} WHERE tenant_id = ANY(%s::uuid[])", (ids,))
        c.execute("DELETE FROM platform.tenants WHERE id = ANY(%s::uuid[])", (ids,))


def _scoped(url, tenant):
    conn = psycopg.connect(url, autocommit=False)
    if tenant is not None:
        conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant,))
    return conn


def _make_user(tenant, email):
    with psycopg.connect(ADMIN, autocommit=True) as c:
        return c.execute(
            "INSERT INTO users.users (tenant_id, name, email) VALUES (%s, 'u', %s) RETURNING id", (tenant, email)
        ).fetchone()[0]


def test_tenant_only_sees_own_rows(two_tenants):
    a, b = two_tenants
    _make_user(a, f"a-{uuid.uuid4().hex}@t.io")
    _make_user(b, f"b-{uuid.uuid4().hex}@t.io")
    with _scoped(APP, a) as conn:
        tenants_seen = {r[0] for r in conn.execute("SELECT tenant_id::text FROM users.users")}
    assert tenants_seen == {a}


def test_no_tenant_set_returns_nothing_and_does_not_error(two_tenants):
    _make_user(two_tenants[0], f"n-{uuid.uuid4().hex}@t.io")
    with _scoped(APP, None) as conn:
        assert conn.execute("SELECT count(*) FROM users.users").fetchone()[0] == 0
    with _scoped(APP, "") as conn:  # empty string must behave the same as unset
        assert conn.execute("SELECT count(*) FROM users.users").fetchone()[0] == 0


def test_cannot_insert_into_another_tenant(two_tenants):
    a, b = two_tenants
    with _scoped(APP, a) as conn:
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("INSERT INTO users.users (tenant_id, name, email) VALUES (%s, 'x', 'x@y.z')", (b,))


def test_pooled_connection_does_not_leak_tenant(two_tenants):
    """The real service code path: one pooled connection used for tenant A, then B, then nobody."""
    import pgdb

    a, b = two_tenants
    ua = _make_user(a, f"pa-{uuid.uuid4().hex}@t.io")
    pgdb.DATABASE_URL = APP
    pgdb._pool = None
    pgdb.os.environ["DB_POOL_MAX"] = "1"  # force connection reuse
    pgdb._pool = None
    with pgdb.tenant_cursor(a) as cur:
        cur.execute("SELECT id FROM users.users")
        assert ua in [r["id"] for r in cur.fetchall()]
    with pgdb.tenant_cursor(b) as cur:
        cur.execute("SELECT id FROM users.users")
        assert ua not in [r["id"] for r in cur.fetchall()]
    # A raw checkout (no tenant_cursor) must see no tenant at all.
    with pgdb.get_pool().connection() as conn:
        assert conn.execute("SELECT count(*) AS n FROM users.users").fetchone()["n"] == 0


def test_cascade_delete_removes_dependents(two_tenants):
    a, _ = two_tenants
    with psycopg.connect(ADMIN, autocommit=True) as c:
        uid = _make_user(a, f"c-{uuid.uuid4().hex}@t.io")
        pid = c.execute(
            "INSERT INTO places.places (tenant_id, name, category, lat, lng, city) VALUES (%s,'p','cafe',1,1,'x') RETURNING id", (a,)
        ).fetchone()[0]
        c.execute("INSERT INTO interactions.interactions (tenant_id, user_id, place_id, type) VALUES (%s,%s,%s,'view')", (a, uid, pid))
        c.execute(
            "INSERT INTO itineraries.itineraries (tenant_id, user_id, title, start_time, end_time) VALUES (%s,%s,'t',now(),now())",
            (a, uid),
        )
    with _scoped(APP, a) as conn:
        conn.execute("DELETE FROM users.users WHERE id = %s", (uid,))
        conn.commit()
    with psycopg.connect(ADMIN, autocommit=True) as c:
        assert c.execute("SELECT count(*) FROM interactions.interactions WHERE user_id = %s", (uid,)).fetchone()[0] == 0
        assert c.execute("SELECT count(*) FROM itineraries.itineraries WHERE user_id = %s", (uid,)).fetchone()[0] == 0


@pytest.mark.skipif(not GATEWAY, reason="TEST_GATEWAY_URL not set")
def test_gateway_role_cannot_read_tenant_data():
    with psycopg.connect(GATEWAY) as conn:
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("SELECT 1 FROM users.users LIMIT 1")


@pytest.mark.skipif(not TRAINER, reason="TEST_TRAINER_URL not set")
def test_trainer_role_is_read_only_on_interactions(two_tenants):
    with psycopg.connect(TRAINER) as conn:
        conn.execute("SELECT count(*) FROM interactions.interactions").fetchone()
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("DELETE FROM interactions.interactions")
        conn.rollback()
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("SELECT 1 FROM users.users LIMIT 1")
