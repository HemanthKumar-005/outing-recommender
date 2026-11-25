import os
import sentry_sdk


def init_sentry(service_name: str) -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return  # Sentry is optional — don't crash if DSN is unset
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
