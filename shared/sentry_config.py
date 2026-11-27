import os

try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None  # type: ignore


def init_sentry(service_name: str) -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn or sentry_sdk is None:
        return  # Sentry is optional — don't crash if DSN is unset or SDK not installed
    integrations = []
    try:
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        integrations.append(FastApiIntegration())
    except Exception:
        pass
    sentry_sdk.init(
        dsn=dsn,
        integrations=integrations,
        environment=os.environ.get("ENVIRONMENT", "development"),
        release=f"{service_name}@{os.environ.get('GIT_SHA', 'unknown')}",
        traces_sample_rate=0.1,  # 10% of requests traced — adjust per traffic
        send_default_pii=False,  # never send PII to Sentry
    )

