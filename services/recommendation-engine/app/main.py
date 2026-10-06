"""
Lightweight recommendation endpoint that applies occasion-aware fusion.

When a full CF/XGBoost pipeline is present elsewhere, import fuse_candidate
from fusion.py. This service provides a working path using place catalog +
occasion scoring so Date Planner and Discover can function end-to-end.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Any

import httpx
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from config_loader import list_occasions_public, ranking_config  # noqa: E402
from occasion_scoring import occasion_score  # noqa: E402
from tenant import require_tenant  # noqa: E402

from .fusion import fuse_candidate, profile_weights

app = FastAPI(title="Recommendation Engine")

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")
_client = httpx.AsyncClient(timeout=8.0)


class RecommendRequest(BaseModel):
    user_id: int | None = None
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None
    city: str | None = None
    state: str | None = None
    category: str | None = None
    outing_type: str | None = None
    occasion: str | None = None
    duration: str | None = None
    diversity: float | None = None
    limit: int = 20


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _distance_score(dist_km: float, radius_km: float) -> float:
    if radius_km <= 0:
        return 0.0
    return max(0.0, 1.0 - dist_km / radius_km)


@app.get("/health")
def health():
    return {"status": "ok", "service": "recommendation-engine"}


@app.get("/occasions")
def occasions():
    return {"occasions": list_occasions_public()}


@app.get("/model-info")
def model_info():
    return {
        "occasion_fusion": True,
        "weights": profile_weights(0),
        "ranking_config_keys": list(ranking_config().keys()),
    }


@app.post("/recommendations")
async def recommend(body: RecommendRequest, tenant_id: str = Depends(require_tenant)):
    lat, lng = body.lat, body.lng
    radius = body.radius_km
    # Prefer explicit city choice — resolve coordinates from pan-India index
    if body.city and (lat is None or lng is None):
        try:
            res = await _client.get(
                f"{PLACE_SERVICE_URL}/locations/resolve",
                params={"city": body.city, **({"state": body.state} if body.state else {})},
                headers={"X-Tenant-Id": tenant_id},
            )
            if res.status_code == 200:
                hit = res.json()
                lat = float(hit["lat"])
                lng = float(hit["lng"])
        except Exception:
            pass
    if lat is None or lng is None:
        return {"recommendations": [], "error": "lat/lng or city required", "context": {}}
    if radius is None:
        radius = 25.0

    # Search place catalog by geo — never a hard-coded list of venues
    r = await _client.get(
        f"{PLACE_SERVICE_URL}/search",
        params={
            "lat": lat,
            "lng": lng,
            "radius_km": radius,
            "limit": 200,
            **({"category": body.category} if body.category else {}),
            **({"city": body.city} if body.city else {}),
            **({"state": body.state} if body.state else {}),
        },
        headers={"X-Tenant-Id": tenant_id},
    )
    r.raise_for_status()
    payload = r.json()
    places = payload.get("places", payload) if isinstance(payload, dict) else payload
    
    CONTEXT_SERVICE_URL = os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000")
    INTERACTION_SERVICE_URL = os.environ.get("INTERACTION_SERVICE_URL", "http://interaction-service:8000")

    # Fetch context
    env_context = {}
    try:
        c_res = await _client.get(
            f"{CONTEXT_SERVICE_URL}/context",
            params={"lat": lat, "lng": lng},
            headers={"X-Tenant-Id": tenant_id}
        )
        if c_res.status_code == 200:
            env_context = c_res.json()
    except Exception:
        pass

    # Fetch interaction history
    n_positive_interactions = 0
    if body.user_id:
        try:
            i_res = await _client.get(
                f"{INTERACTION_SERVICE_URL}/users/{body.user_id}/interactions",
                headers={"X-Tenant-Id": tenant_id}
            )
            if i_res.status_code == 200:
                interactions = i_res.json()
                n_positive_interactions = sum(
                    1 for i in interactions 
                    if i.get("type") in ("like", "save", "visit", "rating") and i.get("rating", 4.0) >= 4.0
                )
        except Exception:
            pass

    results = []
    for place in places:
        if body.category and place.get("category") != body.category:
            continue
        dist = _haversine(lat, lng, float(place["lat"]), float(place["lng"]))
        if dist > radius:
            continue

        # Lightweight stand-ins for full CBF/CF/ML until those modules land
        popularity = float(place.get("popularity_score") or 0.5)
        sentiment = float(place.get("sentiment_score") or 0.5)
        rating = float(place.get("rating") or 3.5) / 5.0
        
        # Adjust context score based on weather (e.g., lower score for outdoor if raining)
        context_score = 0.5
        weather = env_context.get("weather", {})
        if weather:
            is_rain = weather.get("condition") == "rain"
            is_outdoor = place.get("indoor_outdoor") == "outdoor"
            if is_rain and is_outdoor:
                context_score = 0.1
            elif not is_rain and is_outdoor:
                context_score = 0.8
                
        components = {
            "content": rating,
            "collaborative": 0.0,
            "ml": 0.5,
            "context": context_score,
            "distance": _distance_score(dist, radius),
            "popularity": popularity,
            "sentiment": sentiment,
        }
        score, reasons, breakdown = fuse_candidate(
            place,
            components,
            occasion=body.occasion,
            n_positive_interactions=n_positive_interactions,
        )
        if body.outing_type == "couple" and place.get("couple_friendly"):
            score = min(1.0, score + 0.05)
            reasons.append("Couple-friendly")

        results.append(
            {
                "place": place,
                "score": round(score, 4),
                "distance_km": round(dist, 2),
                "reasons": reasons,
                "breakdown": {k: round(v, 4) for k, v in breakdown.items()},
            }
        )

    results.sort(key=lambda x: x["score"], reverse=True)
    limit = max(1, min(body.limit, 50))
    return {
        "recommendations": results[:limit],
        "context": {
            "occasion": body.occasion,
            "duration": body.duration,
            "outing_type": body.outing_type,
            "radius_km": radius,
        },
        "weights": profile_weights(0),
    }
