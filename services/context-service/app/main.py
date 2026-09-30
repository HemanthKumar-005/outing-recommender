import hashlib
import os
import time
from datetime import datetime

import httpx
import redis
from fastapi import FastAPI, Query

app = FastAPI(title="Context Service")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CACHE_TTL_SECONDS = 600
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


@app.get("/health")
def health():
    return {"status": "ok", "service": "context-service"}


@app.get("/ready")
def ready():
    try:
        get_redis().ping()
        return {"status": "ready", "redis": "ok"}
    except Exception as e:  # noqa: BLE001
        # Redis is a cache, not a hard dependency - degrade rather than fail.
        return {"status": "ready", "redis": f"unavailable ({e}), continuing without cache"}


def _time_of_day_bucket(dt: datetime) -> str:
    h = dt.hour
    if 5 <= h < 11:
        return "morning"
    if 11 <= h < 17:
        return "afternoon"
    if 17 <= h < 21:
        return "evening"
    return "night"


def _mock_weather(lat: float, lng: float, dt: datetime) -> dict:
    """Deterministic pseudo-weather so results are stable without network access."""
    seed = f"{round(lat, 1)}:{round(lng, 1)}:{dt.strftime('%Y-%m-%d')}"
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    temp_c = 15 + (h % 20)  # 15-34C
    conditions = ["clear", "clouds", "rain", "clear", "clouds"]
    condition = conditions[h % len(conditions)]
    return {"temp_c": temp_c, "condition": condition, "source": "mock"}


def _live_weather(lat: float, lng: float) -> dict | None:
    try:
        resp = httpx.get(
            OPEN_METEO_URL,
            params={"latitude": lat, "longitude": lng, "current_weather": "true"},
            timeout=3.0,
        )
        resp.raise_for_status()
        cw = resp.json().get("current_weather", {})
        code = cw.get("weathercode", 0)
        condition = "clear" if code == 0 else ("clouds" if code < 4 else "rain")
        return {"temp_c": cw.get("temperature"), "condition": condition, "source": "open-meteo"}
    except Exception as e:  # noqa: BLE001
        print(f"[context-service] live weather fetch failed: {e}")
        return None


@app.get("/context")
def get_context(lat: float, lng: float, at: str | None = Query(None, description="ISO datetime, default now")):
    dt = datetime.fromisoformat(at) if at else datetime.now()

    cache_key = f"weather:{round(lat, 2)}:{round(lng, 2)}"
    r = get_redis()
    weather = None
    try:
        cached = r.get(cache_key)
        if cached:
            import json
            weather = json.loads(cached)
    except Exception as e:  # noqa: BLE001
        print(f"[context-service] redis read failed: {e}")

    if weather is None:
        weather = _live_weather(lat, lng) or _mock_weather(lat, lng, dt)
        try:
            import json
            r.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(weather))
        except Exception as e:  # noqa: BLE001
            print(f"[context-service] redis write failed: {e}")

    return {
        "lat": lat,
        "lng": lng,
        "datetime": dt.isoformat(),
        "day_of_week": dt.strftime("%A").lower(),
        "is_weekend": dt.weekday() >= 5,
        "time_of_day": _time_of_day_bucket(dt),
        "weather": weather,
        "fetched_at": time.time(),
    }
