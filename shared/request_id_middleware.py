import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

try:
    from shared.logging_config import request_id_var
except ImportError:
    from logging_config import request_id_var


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Reads X-Request-ID from the incoming request (set by Nginx or the caller).
    If absent, generates a new UUID4. Stores it in a ContextVar so all log
    lines within this request automatically include it. Also echoes it back
    in the response header so callers can correlate logs end-to-end.
    """
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_var.set(request_id)
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        request_id_var.reset(token)
        return response
