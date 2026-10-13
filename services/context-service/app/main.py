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
OPENWEATHERMAP_API_KEY = os.environ.get("OPENWEATHERMAP_API_KEY", "")
OPENWEATHERMAP_URL = "https://api.openweathermap.org/data/2.5/weather"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


@app.get("/health")
def health():
    return {"status": "ok", "service": "context-service", "has_openweathermap_key": bool(OPENWEATHERMAP_API_KEY)}


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


def _fetch_openweathermap(lat: float, lng: float) -> dict | None:
    if not OPENWEATHERMAP_API_KEY:
        return None
    try:
        resp = httpx.get(
            OPENWEATHERMAP_URL,
            params={
                "lat": lat,
                "lon": lng,
                "appid": OPENWEATHERMAP_API_KEY,
                "units": "metric",
            },
            timeout=4.0,
        )
        resp.raise_for_status()
        data = resp.json()
        main = data.get("main", {})
        weather_arr = data.get("weather", [{}])
        weather_item = weather_arr[0] if weather_arr else {}
        main_condition = (weather_item.get("main") or "").lower()
        desc = (weather_item.get("description") or "").lower()

        # Map to standard condition: 'rain', 'clouds', 'clear', 'snow'
        if any(w in main_condition or w in desc for w in ("rain", "drizzle", "thunderstorm")):
            condition = "rain"
        elif "snow" in main_condition or "snow" in desc:
            condition = "snow"
        elif any(w in main_condition for w in ("cloud", "mist", "fog", "haze", "smoke")):
            condition = "clouds"
        elif "clear" in main_condition:
            condition = "clear"
        else:
            condition = main_condition or "clear"

        return {
            "temp_c": round(float(main.get("temp", 22.0)), 1),
            "feels_like_c": round(float(main.get("feels_like", main.get("temp", 22.0))), 1),
            "humidity": main.get("humidity"),
            "condition": condition,
            "description": desc,
            "wind_speed": data.get("wind", {}).get("speed"),
            "city_name": data.get("name"),
            "source": "openweathermap",
        }
    except Exception as e:  # noqa: BLE001
        print(f"[context-service] openweathermap fetch failed: {e}")
        return None


def _fetch_open_meteo(lat: float, lng: float) -> dict | None:
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
        print(f"[context-service] open-meteo live weather fetch failed: {e}")
        return None


def _live_weather(lat: float, lng: float) -> dict | None:
    # 1. Try OpenWeatherMap (highest fidelity, user-configured)
    owm = _fetch_openweathermap(lat, lng)
    if owm:
        return owm

    # 2. Fall back to Open-Meteo
    return _fetch_open_meteo(lat, lng)


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
