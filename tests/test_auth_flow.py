"""End-to-end auth tests: real gateway + user-service processes, real Postgres + Redis.

Skipped unless TEST_E2E=1 and the TEST_* DB variables are set (see .github/workflows/ci.yml).
"""
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(os.environ.get("TEST_E2E") != "1", reason="TEST_E2E not set")

GW = "http://127.0.0.1:18000"
ORIGIN = {"Origin": "http://localhost:3000"}
PW = "correct-horse-battery"


def _wait(url, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if httpx.get(url, timeout=1).status_code < 500:
                return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError(f"{url} did not start")


@pytest.fixture(scope="module", autouse=True)
def stack():
    base = {
        **os.environ,
        "JWT_SECRET": "j" * 48, "INTERNAL_SERVICE_TOKEN": "internal-test-token",
        "APP_ENV": "development", "REQUIRE_EMAIL_VERIFICATION": "false",
        "DATABASE_URL": os.environ["TEST_APP_URL"], "PLATFORM_DATABASE_URL": os.environ["TEST_GATEWAY_URL"],
        "REDIS_URL": "redis://127.0.0.1:6379/0", "RABBITMQ_URL": "amqp://nobody:nobody@127.0.0.1:1/%2F",
        "USER_SERVICE_URL": "http://127.0.0.1:18001", "PLACE_SERVICE_URL": "http://127.0.0.1:18002", "ITINERARY_SERVICE_URL": "http://127.0.0.1:18003", "TURNSTILE_SECRET_KEY": "",
        "SMTP_HOST": "", "CORS_ORIGINS": "http://localhost:3000", "PYTHONPATH": str(ROOT / "shared"),
    }
    procs = []
    for name, port in (("user-service", 18001), ("place-service", 18002), ("itinerary-service", 18003), ("api-gateway", 18000)):
        procs.append(subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port), "--log-level", "warning"],
            cwd=ROOT / "services" / name, env=base,
        ))
    try:
        _wait("http://127.0.0.1:18001/health")
        _wait("http://127.0.0.1:18002/health")
        _wait("http://127.0.0.1:18003/health", 40)
        _wait(f"{GW}/health")
        httpx.Client().post  # noqa
        import redis
        redis.Redis().flushdb()  # clean rate-limit counters between runs
        yield
    finally:
        for p in procs:
            p.terminate()


def _signup(c, email=None, pw=PW):
    email = email or f"{uuid.uuid4().hex[:10]}@example.com"
    r = c.post(f"{GW}/auth/signup", json={"name": "T", "email": email, "password": pw, "accept_terms": True}, headers=ORIGIN)
    return email, r


def _login(email, pw=PW):
    c = httpx.Client()
    r = c.post(f"{GW}/auth/login", json={"email": email, "password": pw}, headers=ORIGIN)
    return c, r


def test_signup_login_me_roundtrip():
    email, r = _signup(httpx.Client())
    assert r.status_code == 202
    c, r = _login(email)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert "password" not in r.text.lower()
    me = c.get(f"{GW}/auth/me")
    assert me.status_code == 200 and me.json()["user"]["email"] == email
    assert "password_hash" not in me.text


def test_wrong_password_and_unknown_user_look_identical():
    email, _ = _signup(httpx.Client())
    _, bad = _login(email, "wrong-password-123")
    _, unknown = _login("nobody-here@example.com")
    assert bad.status_code == unknown.status_code == 401
    assert bad.json() == unknown.json()


def test_duplicate_signup_does_not_reveal_existing_account():
    email, first = _signup(httpx.Client())
    _, second = _signup(httpx.Client(), email)
    assert first.status_code == second.status_code == 202 and first.json() == second.json()


def test_weak_password_rejected():
    _, r = _signup(httpx.Client(), pw="short")
    assert r.status_code == 400


def test_unauthenticated_proxy_is_rejected():
    assert httpx.get(f"{GW}/api/users/users/1").status_code == 401
    assert httpx.get(f"{GW}/api/users/users/me", headers={"X-API-Key": "demo-key"}).status_code == 401


def test_user_cannot_read_other_users_or_list_all():
    ea, _ = _signup(httpx.Client()); a, _ = _login(ea)
    eb, _ = _signup(httpx.Client()); b, _ = _login(eb)
    a_id = a.get(f"{GW}/auth/me").json()["user"]["id"]
    b_id = b.get(f"{GW}/auth/me").json()["user"]["id"]
    assert a.get(f"{GW}/api/users/users/{a_id}").status_code == 200
    assert a.get(f"{GW}/api/users/users/{b_id}").status_code == 404      # not 403: no existence oracle
    assert a.put(f"{GW}/api/users/users/{b_id}/preferences", json={"budget_max": 1}, headers=ORIGIN).status_code == 404
    assert a.get(f"{GW}/api/users/users").status_code == 403
    assert a.post(f"{GW}/api/users/users", json={"name": "x", "email": "x@y.zz"}, headers=ORIGIN).status_code == 403


def test_client_cannot_spoof_identity_headers():
    ea, _ = _signup(httpx.Client()); a, _ = _login(ea)
    eb, _ = _signup(httpx.Client()); b, _ = _login(eb)
    b_id = b.get(f"{GW}/auth/me").json()["user"]["id"]
    r = a.get(f"{GW}/api/users/users/{b_id}", headers={"X-User-Id": str(b_id), "X-User-Role": "admin", "X-Tenant-Id": "x"})
    assert r.status_code == 404


def test_csrf_origin_check_on_cookie_requests():
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    uid = c.get(f"{GW}/auth/me").json()["user"]["id"]
    body = {"budget_max": 2}
    assert c.put(f"{GW}/api/users/users/{uid}/preferences", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert c.put(f"{GW}/api/users/users/{uid}/preferences", json=body).status_code == 403  # no Origin at all
    assert c.put(f"{GW}/api/users/users/{uid}/preferences", json=body, headers=ORIGIN).status_code == 200


def test_forged_token_rejected():
    import jwt
    forged = jwt.encode({"sub": "1", "tid": "00000000-0000-0000-0000-000000000000", "exp": int(time.time()) + 999}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    assert httpx.get(f"{GW}/auth/me", cookies={"nb_session": forged}).status_code == 401


def test_delete_account_then_session_dead():
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    assert c.delete(f"{GW}/api/users/users/me", headers=ORIGIN).status_code == 200
    assert c.get(f"{GW}/auth/me").status_code == 401
    assert _login(e)[1].status_code == 401


def test_tenant_key_is_hashed_and_rotation_revokes_old_key():
    r = httpx.post(f"{GW}/tenants", json={"name": "Acme"}, headers=ORIGIN)
    assert r.status_code == 201
    key = r.json()["api_key"]
    import psycopg
    with psycopg.connect(os.environ["TEST_ADMIN_URL"]) as db:
        stored = db.execute("SELECT api_key_hash FROM platform.tenants WHERE id = %s", (r.json()["tenant_id"],)).fetchone()[0]
    assert key not in stored and len(stored) == 64
    assert httpx.get(f"{GW}/api/users/users", headers={"X-API-Key": key}).status_code == 200
    rot = httpx.post(f"{GW}/tenant/api-key/rotate", headers={"X-API-Key": key})
    assert rot.status_code == 200
    assert httpx.get(f"{GW}/api/users/users", headers={"X-API-Key": key}).status_code == 401
    assert httpx.get(f"{GW}/api/users/users", headers={"X-API-Key": rot.json()["api_key"]}).status_code == 200
    assert httpx.post(f"{GW}/tenant/api-key/revoke", headers={"X-API-Key": rot.json()["api_key"]}).status_code == 200
    assert httpx.get(f"{GW}/api/users/users", headers={"X-API-Key": rot.json()["api_key"]}).status_code == 401


def test_email_verification_token_flow_and_single_use():
    import psycopg
    with psycopg.connect(os.environ["TEST_ADMIN_URL"]) as db:
        tid = str(db.execute("SELECT id FROM platform.tenants WHERE is_consumer").fetchone()[0])
    h = {"X-Tenant-Id": tid, "X-Internal-Token": "internal-test-token"}
    us = "http://127.0.0.1:18001"
    email = f"{uuid.uuid4().hex[:8]}@example.com"
    r = httpx.post(f"{us}/internal/auth/register", headers=h, json={
        "name": "V", "email": email, "password": PW, "accept_terms": True, "require_verification": True})
    assert r.status_code == 201 and r.json()["user"]["email_verified_at"] is None
    token = r.json()["verification_token"]
    assert httpx.post(f"{us}/internal/auth/verify-email", headers=h, json={"token": "bogus" * 8}).status_code == 400
    ok = httpx.post(f"{us}/internal/auth/verify-email", headers=h, json={"token": token})
    assert ok.status_code == 200 and ok.json()["user"]["email_verified_at"]
    assert httpx.post(f"{us}/internal/auth/verify-email", headers=h, json={"token": token}).status_code == 400  # single use
    # credential endpoints refuse callers without the internal token
    assert httpx.post(f"{us}/internal/auth/verify-credentials", headers={"X-Tenant-Id": tid},
                      json={"email": email, "password": PW}).status_code == 403


def _consumer_place():
    import psycopg
    with psycopg.connect(os.environ["TEST_ADMIN_URL"], autocommit=True) as db:
        tid = db.execute("SELECT id FROM platform.tenants WHERE is_consumer").fetchone()[0]
        return db.execute(
            "INSERT INTO places.places (tenant_id, name, category, lat, lng, city, opening_hours_is_estimated) "
            "VALUES (%s, %s, 'cafe', 12.97, 77.59, 'Bengaluru', true) RETURNING id",
            (tid, f"Test Cafe {uuid.uuid4().hex[:6]}"),
        ).fetchone()[0]


def test_estimated_hours_never_claim_open_or_closed():
    pid = _consumer_place()
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    r = c.get(f"{GW}/api/places/places/{pid}")
    assert r.status_code == 200
    body = r.json()
    assert body["open_now"] is None and body["hours_is_estimated"] is True
    assert "verify ahead" in body["hours_detail"]


def test_nearby_endpoint_exists():
    pid = _consumer_place()
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    r = c.get(f"{GW}/api/places/places/nearby", params={"lat": 12.97, "lng": 77.59, "radius_km": 5})
    assert r.status_code == 200 and pid in [p["id"] for p in r.json()]


def test_end_user_cannot_write_catalog_but_can_report():
    pid = _consumer_place()
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    assert c.post(f"{GW}/api/places/places", json={"name": "x", "category": "cafe", "lat": 1, "lng": 1}, headers=ORIGIN).status_code == 403
    assert c.patch(f"{GW}/api/places/places/{pid}/sentiment", json={"sentiment_score": 0.9}, headers=ORIGIN).status_code == 403
    assert c.get(f"{GW}/api/places/admin/issue-reports").status_code == 403
    r = c.post(f"{GW}/api/places/places/{pid}/report", json={"issue_type": "closed", "details": "shutters down"}, headers=ORIGIN)
    assert r.status_code == 201


def test_accepted_closed_report_hides_the_venue():
    import psycopg
    pid = _consumer_place()
    e, _ = _signup(httpx.Client()); c, _ = _login(e)
    rid = c.post(f"{GW}/api/places/places/{pid}/report", json={"issue_type": "closed"}, headers=ORIGIN).json()["id"]
    with psycopg.connect(os.environ["TEST_ADMIN_URL"], autocommit=True) as db:
        tid = db.execute("SELECT id FROM platform.tenants WHERE is_consumer").fetchone()[0]
    # moderation is a tenant/operator action: call the place-service directly as the operator would
    h = {"X-Tenant-Id": str(tid)}
    assert httpx.post(f"http://127.0.0.1:18002/admin/issue-reports/{rid}/resolve", json={"accept": True}, headers=h).status_code == 200
    assert c.get(f"{GW}/api/places/places/{pid}").status_code == 404


def _itinerary_for(user_id):
    import psycopg
    with psycopg.connect(os.environ["TEST_ADMIN_URL"], autocommit=True) as db:
        tid = db.execute("SELECT id FROM platform.tenants WHERE is_consumer").fetchone()[0]
        iid = db.execute(
            "INSERT INTO itineraries.itineraries (tenant_id, user_id, title, start_time, end_time) "
            "VALUES (%s, %s, 'Sat plan', now(), now() + interval '3 hours') RETURNING id", (tid, user_id)).fetchone()[0]
        pid = _consumer_place()
        db.execute(
            "INSERT INTO itineraries.itinerary_items (tenant_id, itinerary_id, place_id, name, category, lat, lng, arrival, departure) "
            "VALUES (%s, %s, %s, 'Test Cafe', 'cafe', 12.97, 77.59, now(), now() + interval '1 hour')", (tid, iid, pid))
        return iid


def test_itineraries_are_private_shareable_and_exportable():
    ea, _ = _signup(httpx.Client()); a, _ = _login(ea)
    eb, _ = _signup(httpx.Client()); b, _ = _login(eb)
    a_id = a.get(f"{GW}/auth/me").json()["user"]["id"]
    iid = _itinerary_for(a_id)
    assert a.get(f"{GW}/api/itinerary/itineraries/{iid}").status_code == 200
    # another signed-in user: 404 on read, share, export, reorder
    assert b.get(f"{GW}/api/itinerary/itineraries/{iid}").status_code == 404
    assert b.post(f"{GW}/api/itinerary/itineraries/{iid}/share", headers=ORIGIN).status_code == 404
    assert b.get(f"{GW}/api/itinerary/itineraries/{iid}/calendar.ics").status_code == 404
    assert iid not in [i["id"] for i in b.get(f"{GW}/api/itinerary/itineraries").json()]
    # owner: .ics is a real calendar file with the right headers
    ics = a.get(f"{GW}/api/itinerary/itineraries/{iid}/calendar.ics")
    assert ics.status_code == 200 and ics.headers["content-type"].startswith("text/calendar")
    assert "attachment" in ics.headers["content-disposition"] and "BEGIN:VEVENT" in ics.text
    # share link is public, read-only and leaks no user identity
    token = a.post(f"{GW}/api/itinerary/itineraries/{iid}/share", headers=ORIGIN).json()["share_token"]
    pub = httpx.get(f"{GW}/api/itinerary/shared/{token}")
    assert pub.status_code == 200 and "user_id" not in pub.text and pub.json()["title"] == "Sat plan"
    assert a.delete(f"{GW}/api/itinerary/itineraries/{iid}/share", headers=ORIGIN).status_code == 200
    assert httpx.get(f"{GW}/api/itinerary/shared/{token}").status_code == 404
