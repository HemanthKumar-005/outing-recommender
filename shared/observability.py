"""Structured JSON logging, request-ID propagation and optional error tracking.

Usage in a FastAPI service:

    from observability import setup_observability
    setup_observability(app, "user-service")

* Every request gets an `X-Request-ID` (taken from the incoming header when it is a
  sane value, otherwise generated) which is echoed in the response, stored in a
  contextvar, and included in every log line.
* Outbound calls to other services should add `propagate_headers()` so the same
  id follows the request across the whole chain.
* Error tracking uses the Sentry protocol. Point SENTRY_DSN at a free Sentry
  Developer project *or* a self-hosted GlitchTip instance (both speak the same
  protocol). Without a DSN nothing is sent.
"""
from __future__ import annotations

import contextvars
import json
import logging
import os
import re
import sys
import time
import uuid

REQUEST_ID_HEADER = "X-Request-ID"
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
_SAFE_ID = re.compile(r"^[A-Za-z0-9._\-]{8,64}$")


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str):
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "service": self.service,
            "request_id": request_id_var.get(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("method", "path", "status", "duration_ms", "tenant_id", "user_id"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def propagate_headers(headers: dict | None = None) -> dict:
    """Add the current request id to an outbound header dict."""
    out = dict(headers or {})
    rid = request_id_var.get()
    if rid and rid != "-":
        out[REQUEST_ID_HEADER] = rid
    return out


def _init_sentry(service: str) -> None:
    dsn = os.environ.get("SENTRY_DSN", "")
    if not dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("APP_ENV", "development"),
            release=os.environ.get("APP_RELEASE"),
            # Free plans have small quotas: sample traces lightly and never send PII.
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
            send_default_pii=False,
            server_name=service,
        )
    except Exception as e:  # noqa: BLE001
        logging.getLogger(service).warning("sentry init failed: %s", e)


def setup_observability(app, service: str) -> None:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    for noisy in ("uvicorn", "uvicorn.error"):
        logging.getLogger(noisy).handlers[:] = [handler]
    logging.getLogger("uvicorn.access").handlers[:] = []  # replaced by our access log below
    logging.getLogger("uvicorn.access").propagate = False

    _init_sentry(service)
    log = logging.getLogger(f"{service}.access")

    @app.middleware("http")
    async def _request_id_middleware(request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        rid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers[REQUEST_ID_HEADER] = rid
            return response
        finally:
            if request.url.path not in ("/health", "/healthz"):
                log.info(
                    "request",
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                    },
                )
            request_id_var.reset(token)
