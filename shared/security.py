"""Security primitives shared by the gateway and services: API-key hashing,
Argon2id password hashing and signed session tokens (JWT, HS256)."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from typing import Any

SESSION_COOKIE = "nb_session"
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", str(7 * 24 * 3600)))
JWT_ALG = "HS256"


# --------------------------------------------------------------------- API keys
def generate_api_key() -> tuple[str, str, str]:
    """Return (full_key, sha256_hash, display_prefix). Show full_key once, store the rest."""
    full = "nb_" + secrets.token_urlsafe(32)
    return full, hash_api_key(full), full[:11]


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# -------------------------------------------------------------------- passwords
_hasher = None


def _get_hasher():
    global _hasher
    if _hasher is None:
        from argon2 import PasswordHasher  # lazy import keeps non-auth services light

        # argon2-cffi defaults follow RFC 9106 "low memory" guidance (Argon2id).
        _hasher = PasswordHasher()
    return _hasher


def hash_password(password: str) -> str:
    return _get_hasher().hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Constant-ish time: always performs a hash verify, even for unknown users."""
    from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

    h = password_hash or _DUMMY_HASH()
    try:
        ok = _get_hasher().verify(h, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return bool(ok) and password_hash is not None


_dummy: str | None = None


def _DUMMY_HASH() -> str:  # noqa: N802
    global _dummy
    if _dummy is None:
        _dummy = _get_hasher().hash("not-a-real-password")
    return _dummy


def password_needs_rehash(password_hash: str) -> bool:
    return _get_hasher().check_needs_rehash(password_hash)


def validate_password_strength(password: str, email: str = "") -> str | None:
    """Return an error message, or None if the password is acceptable."""
    if len(password) < 10:
        return "Password must be at least 10 characters."
    if len(password) > 128:
        return "Password must be at most 128 characters."
    if email and password.lower() == email.lower():
        return "Password must not be your email address."
    if password.lower() in {"password123", "1234567890", "qwertyuiop", "password1234"}:
        return "That password is too common."
    return None


# -------------------------------------------------------------------------- JWT
def _secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be set to a random string of at least 32 characters")
    return secret


def mint_session_token(user_id: int, tenant_id: str, role: str = "user", ttl: int | None = None) -> str:
    import jwt

    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": str(user_id),
        "tid": str(tenant_id),
        "role": role,
        "iat": now,
        "exp": now + (ttl or SESSION_TTL_SECONDS),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(claims, _secret(), algorithm=JWT_ALG)


def decode_session_token(token: str) -> dict[str, Any] | None:
    import jwt

    try:
        claims = jwt.decode(token, _secret(), algorithms=[JWT_ALG], options={"require": ["exp", "sub", "tid"]})
        int(claims["sub"])  # must be numeric
        return claims
    except Exception:  # noqa: BLE001 - any failure means "not authenticated"
        return None


def new_one_time_token() -> tuple[str, str]:
    """Return (token_for_email_link, sha256_hash_to_store)."""
    t = secrets.token_urlsafe(32)
    return t, hashlib.sha256(t.encode()).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def safe_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
