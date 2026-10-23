"""Caller identity as forwarded by the API gateway to internal services.

The gateway authenticates the caller (session cookie / bearer JWT, or a tenant
API key), strips any client-supplied identity headers, then sets:

    X-Tenant-Id : tenant the request is scoped to (always present)
    X-User-Id   : authenticated end user (absent for tenant-level API-key calls)
    X-User-Role : "user" | "admin"

Internal services trust these headers because they are only reachable on the
private Docker network (ports are bound to 127.0.0.1 / not published at all).
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from tenant import require_tenant  # type: ignore

USER_HEADER = "X-User-Id"
ROLE_HEADER = "X-User-Role"


@dataclass(frozen=True)
class Principal:
    tenant_id: str
    user_id: int | None  # None => tenant-level (API key / service-to-service) caller
    role: str = "user"

    @property
    def is_admin(self) -> bool:
        return self.user_id is None or self.role == "admin"

    def can_access_user(self, target_user_id: int | None) -> bool:
        """Tenant-level callers and admins may touch any user in the tenant;
        end users may only touch themselves."""
        if self.is_admin:
            return True
        return target_user_id is not None and target_user_id == self.user_id


def get_principal(
    tenant_id: str = Depends(require_tenant),
    x_user_id: str | None = Header(None, alias=USER_HEADER),
    x_user_role: str | None = Header(None, alias=ROLE_HEADER),
) -> Principal:
    uid: int | None = None
    if x_user_id:
        try:
            uid = int(x_user_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="invalid X-User-Id") from e
    role = x_user_role if x_user_role in ("user", "admin") else "user"
    return Principal(tenant_id=tenant_id, user_id=uid, role=role)


def require_self_or_admin(principal: Principal, target_user_id: int) -> None:
    if not principal.can_access_user(target_user_id):
        # 404, not 403: don't confirm that another user's id exists.
        raise HTTPException(status_code=404, detail="not found")
