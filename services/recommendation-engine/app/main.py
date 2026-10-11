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
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
if (_ROOT / "shared").is_dir() and str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))
if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")

from config_loader import list_occasions_public, ranking_config  # noqa: E402
from features import build_feature_vector  # noqa: E402
from occasion_scoring import occasion_score  # noqa: E402
from tenant import require_tenant  # noqa: E402

from . import scoring
from .fusion import fuse_candidate, profile_weights
from .model import model_manager

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
    open_now: bool | None = None
    budget: str | None = None
    sort_by: str | None = None  # "match", "distance", "price"
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


@app.on_event("startup")
def startup_event():
    model_manager.load()
    model_manager.start_listener()


@app.get("/model-info")
def model_info():
    meta = model_manager.metadata or {}
    return {
        "occasion_fusion": True,
        "weights": profile_weights(0),
        "ranking_config_keys": list(ranking_config().keys()),
        "ml_model_loaded": model_manager.is_loaded,
        "ml_model_version": meta.get("version"),
        "ml_feature_version": meta.get("feature_version"),
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

    # Filter candidates by category, open status, and radius
    candidates = []
    for place in places:
        if body.category and place.get("category") != body.category:
            continue
        if body.open_now is True and place.get("open_now") is False:
            continue
        dist = _haversine(lat, lng, float(place["lat"]), float(place["lng"]))
        if dist > radius:
            continue
        candidates.append((place, dist))

    # Build features and predict in ONE batched call across all candidates
    user_dict = {"budget_min": 0, "budget_max": 4}
    feature_rows = []
    for place, dist in candidates:
        place_with_dist = {**place, "distance_km": dist}
        rating = float(place.get("rating") or 3.5) / 5.0
        vec = build_feature_vector(
            place=place_with_dist,
            context=env_context,
            user=user_dict,
            cbf_score=rating,
            cf_score=0.0,
        )
        feature_rows.append(vec)

    ml_predictions = model_manager.predict_batch(feature_rows)

    results = []
    for idx, (place, dist) in enumerate(candidates):
        ml_score = ml_predictions[idx] if idx < len(ml_predictions) else 0.5
        popularity = float(place.get("popularity_score") or 0.5)
        sentiment = float(place.get("sentiment_score") or 0.5)
        rating = float(place.get("rating") or 3.5) / 5.0

        ctx_score, ctx_components = scoring.context_score(
            place,
            env_context,
            user=user_dict,
            outing_type=body.outing_type or "friends",
            budget_override=body.budget,
        )

        components = {
            "content": rating,
            "collaborative": 0.0,
            "ml": ml_score,
            "context": ctx_score,
            "distance": _distance_score(dist, radius),
            "popularity": popularity,
            "sentiment": sentiment,
        }
        score, occ_reasons, breakdown = fuse_candidate(
            place,
            components,
            occasion=body.occasion,
            n_positive_interactions=n_positive_interactions,
        )
        if body.outing_type == "couple" and place.get("couple_friendly"):
            score = min(1.0, score + 0.05)
            if "Couple-friendly" not in occ_reasons:
                occ_reasons.append("Couple-friendly")

        # Explainable reasons including hours and pricing
        breakdown_with_ctx = dict(breakdown)
        breakdown_with_ctx["context_components"] = ctx_components
        explain_reasons = scoring.build_explanation(place, breakdown_with_ctx, dist)

        # Merge reasons maintaining uniqueness
        combined_reasons = []
        for r_text in occ_reasons + explain_reasons:
            if r_text and r_text not in combined_reasons:
                combined_reasons.append(r_text)

        results.append(
            {
                "place": place,
                "score": round(score, 4),
                "distance_km": round(dist, 2),
                "reasons": combined_reasons,
                "breakdown": {k: round(v, 4) for k, v in breakdown.items()},
            }
        )

    if body.sort_by == "distance":
        results.sort(key=lambda x: x["distance_km"])
    elif body.sort_by == "price":
        results.sort(key=lambda x: (x["place"].get("cost_for_two") if x["place"].get("cost_for_two") is not None else 999999))
    else:
        results.sort(key=lambda x: x["score"], reverse=True)

    limit = max(1, min(body.limit, 50))
    return {
        "recommendations": results[:limit],
        "context": {
            "occasion": body.occasion,
            "duration": body.duration,
            "outing_type": body.outing_type,
            "radius_km": radius,
            "open_now": body.open_now,
            "budget": body.budget,
            "sort_by": body.sort_by,
        },
        "weights": profile_weights(0),
    }
