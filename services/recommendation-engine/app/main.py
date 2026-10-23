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
<<<<<<< HEAD

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
=======
from typing import Any

import httpx
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
from pathlib import Path

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

<<<<<<< HEAD
from authctx import Principal, get_principal  # noqa: E402
from observability import propagate_headers, setup_observability  # noqa: E402
from config_loader import list_occasions_public, ranking_config  # noqa: E402
from features import build_feature_vector  # noqa: E402
=======
from config_loader import list_occasions_public, ranking_config  # noqa: E402
from features import build_feature_vector  # noqa: E402
from occasion_scoring import occasion_score  # noqa: E402
from tenant import require_tenant  # noqa: E402
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

from . import scoring
from .fusion import fuse_candidate, profile_weights
from .model import model_manager

app = FastAPI(title="Recommendation Engine")
<<<<<<< HEAD
setup_observability(app, "recommendation-engine")
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://user-service:8000")
CONTEXT_SERVICE_URL = os.environ.get("CONTEXT_SERVICE_URL", "http://context-service:8000")
INTERACTION_SERVICE_URL = os.environ.get("INTERACTION_SERVICE_URL", "http://interaction-service:8000")
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
    weight_overrides: dict[str, float] | None = None


class GroupRecommendRequest(BaseModel):
    user_ids: list[int]
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None
    city: str | None = None
    state: str | None = None
    category: str | None = None
    outing_type: str | None = "friends"
    occasion: str | None = None
    strategy: str = "least_misery"  # "least_misery", "average", "borda"
    open_now: bool | None = None
    budget: str | None = None
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
<<<<<<< HEAD
async def recommend(body: RecommendRequest, principal: Principal = Depends(get_principal)):
    tenant_id = principal.tenant_id
    if principal.user_id is not None and not principal.is_admin:
        body.user_id = principal.user_id  # personalise only for the signed-in user, never for a client-chosen id
=======
async def recommend(body: RecommendRequest, tenant_id: str = Depends(require_tenant)):
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    lat, lng = body.lat, body.lng
    radius = body.radius_km
    # Prefer explicit city choice — resolve coordinates from pan-India index
    if body.city and (lat is None or lng is None):
        try:
            res = await _client.get(
                f"{PLACE_SERVICE_URL}/locations/resolve",
                params={"city": body.city, **({"state": body.state} if body.state else {})},
<<<<<<< HEAD
                headers=propagate_headers({"X-Tenant-Id": tenant_id}),
=======
                headers={"X-Tenant-Id": tenant_id},
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
        headers=propagate_headers({"X-Tenant-Id": tenant_id}),
=======
        headers={"X-Tenant-Id": tenant_id},
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
            headers=propagate_headers({"X-Tenant-Id": tenant_id})
=======
            headers={"X-Tenant-Id": tenant_id}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        )
        if c_res.status_code == 200:
            env_context = c_res.json()
    except Exception:
        pass

    # Fetch user profile and interaction history
    user_dict = {"budget_min": 0, "budget_max": 4, "preferred_categories": [], "ambience_preferences": []}
    n_positive_interactions = 0
    all_interactions = []
    if body.user_id:
        try:
            u_res = await _client.get(
                f"{USER_SERVICE_URL}/users/{body.user_id}",
<<<<<<< HEAD
                headers=propagate_headers({"X-Tenant-Id": tenant_id})
=======
                headers={"X-Tenant-Id": tenant_id}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            )
            if u_res.status_code == 200:
                user_profile = u_res.json()
                user_dict = {
                    "id": body.user_id,
                    "budget_min": user_profile.get("budget_min", 0),
                    "budget_max": user_profile.get("budget_max", 4),
                    "preferred_categories": user_profile.get("preferred_categories") or [],
                    "ambience_preferences": user_profile.get("ambience_preferences") or [],
                    "home_lat": user_profile.get("home_lat"),
                    "home_lng": user_profile.get("home_lng"),
                }
        except Exception:
            pass

        try:
            i_res = await _client.get(
                f"{INTERACTION_SERVICE_URL}/users/{body.user_id}/interactions",
<<<<<<< HEAD
                headers=propagate_headers({"X-Tenant-Id": tenant_id})
=======
                headers={"X-Tenant-Id": tenant_id}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            )
            if i_res.status_code == 200:
                interactions = i_res.json()
                n_positive_interactions = sum(
                    1 for i in interactions 
                    if i.get("type") in ("like", "save", "visit", "rating", "share") and i.get("rating", 4.0) >= 4.0
                )
        except Exception:
            pass

        try:
            ai_res = await _client.get(
                f"{INTERACTION_SERVICE_URL}/interactions",
                params={"limit": 5000},
<<<<<<< HEAD
                headers=propagate_headers({"X-Tenant-Id": tenant_id})
=======
                headers={"X-Tenant-Id": tenant_id}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            )
            if ai_res.status_code == 200:
                all_interactions = ai_res.json()
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

    # Compute Content-Based (CBF) and Collaborative Filtering (CF + Matrix Factorization) scores
    cbf_map = {}
    cf_map = {}
    mf_map = {}
    if candidates:
        candidate_places = [p for p, _ in candidates]
        if user_dict.get("preferred_categories") or user_dict.get("ambience_preferences"):
            try:
                cbf_map = scoring.cbf_scores(user_dict, candidate_places)
            except Exception:
                cbf_map = {}
        if all_interactions and body.user_id:
            try:
                cf_map, cf_pos_count = scoring.cf_scores(body.user_id, candidate_places, all_interactions)
                n_positive_interactions = max(n_positive_interactions, cf_pos_count)
            except Exception:
                cf_map = {}
            try:
                mf_map = scoring.matrix_factorization_scores(body.user_id, candidate_places, all_interactions)
            except Exception:
                mf_map = {}

    # Build features and predict in ONE batched call across all candidates
    feature_rows = []
    for place, dist in candidates:
        place_with_dist = {**place, "distance_km": dist}
        rating = float(place.get("rating") or 3.5) / 5.0
        cbf_val = cbf_map.get(place["id"], rating)
        raw_cf = cf_map.get(place["id"], 0.0)
        raw_mf = mf_map.get(place["id"], 0.0)
        # Latent factor embeddings support cross-category serendipitous discovery
        cf_val = round(max(raw_cf, 0.6 * raw_cf + 0.4 * raw_mf) if raw_cf > 0 else (0.5 * raw_mf if raw_mf > 0 else 0.0), 4)

        vec = build_feature_vector(
            place=place_with_dist,
            context=env_context,
            user=user_dict,
            cbf_score=cbf_val,
            cf_score=cf_val,
        )
        feature_rows.append(vec)

    ml_predictions = model_manager.predict_batch(feature_rows)

    results = []
    for idx, (place, dist) in enumerate(candidates):
        ml_score = ml_predictions[idx] if idx < len(ml_predictions) else 0.5
        popularity = float(place.get("popularity_score") or 0.5)
        sentiment = float(place.get("sentiment_score") or 0.5)
        rating = float(place.get("rating") or 3.5) / 5.0
        cbf_val = cbf_map.get(place["id"], rating)
        cf_val = cf_map.get(place["id"], 0.0)

        ctx_score, ctx_components = scoring.context_score(
            place,
            env_context,
            user=user_dict,
            outing_type=body.outing_type or "friends",
            budget_override=body.budget,
        )

        components = {
            "content": cbf_val,
            "collaborative": cf_val,
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
            weight_overrides=body.weight_overrides,
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
        "weights": profile_weights(n_positive_interactions),
    }


@app.post("/group")
@app.post("/recommendations/group")
<<<<<<< HEAD
async def group_recommend(body: GroupRecommendRequest, principal: Principal = Depends(get_principal)):
    """Multi-user group recommendation using consensus aggregation strategies
    (least_misery, average, borda) from configs/ranking.yaml (Review §1, Domain C Task 11)."""
    tenant_id = principal.tenant_id
    # Reading other people's taste profiles requires their consent, which the product does not
    # have yet (no group invites). Until it does, signed-in users can only include themselves.
    if not principal.is_admin and any(uid != principal.user_id for uid in body.user_ids):
        raise HTTPException(
            status_code=403,
            detail="Group planning with other accounts is not available yet: members must opt in first.",
        )
=======
async def group_recommend(body: GroupRecommendRequest, tenant_id: str = Depends(require_tenant)):
    """Multi-user group recommendation using consensus aggregation strategies
    (least_misery, average, borda) from configs/ranking.yaml (Review §1, Domain C Task 11)."""
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    if not body.user_ids:
        return {"recommendations": [], "error": "user_ids list must not be empty", "strategy": body.strategy}

    lat, lng = body.lat, body.lng
    radius = body.radius_km or 25.0
    if body.city and (lat is None or lng is None):
        try:
            res = await _client.get(
                f"{PLACE_SERVICE_URL}/locations/resolve",
                params={"city": body.city, **({"state": body.state} if body.state else {})},
<<<<<<< HEAD
                headers=propagate_headers({"X-Tenant-Id": tenant_id}),
=======
                headers={"X-Tenant-Id": tenant_id},
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            )
            if res.status_code == 200:
                hit = res.json()
                lat = float(hit["lat"])
                lng = float(hit["lng"])
        except Exception:
            pass

    if lat is None or lng is None:
        return {"recommendations": [], "error": "lat/lng or city required"}

    # Search candidates
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
<<<<<<< HEAD
        headers=propagate_headers({"X-Tenant-Id": tenant_id}),
=======
        headers={"X-Tenant-Id": tenant_id},
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    )
    r.raise_for_status()
    payload = r.json()
    places = payload.get("places", payload) if isinstance(payload, dict) else payload

    # Filter candidates
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

    if not candidates:
        return {"recommendations": [], "group_strategy": body.strategy, "user_ids": body.user_ids}

    # Fetch context
    env_context = {}
    try:
        c_res = await _client.get(
            f"{CONTEXT_SERVICE_URL}/context",
            params={"lat": lat, "lng": lng},
<<<<<<< HEAD
            headers=propagate_headers({"X-Tenant-Id": tenant_id})
=======
            headers={"X-Tenant-Id": tenant_id}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        )
        if c_res.status_code == 200:
            env_context = c_res.json()
    except Exception:
        pass

    # Score candidates for each user independently
    scores_per_user: dict[int, dict[int, float]] = {}
    place_map = {place["id"]: (place, dist) for place, dist in candidates}

    for uid in body.user_ids:
        user_dict = {"id": uid, "budget_min": 0, "budget_max": 4, "preferred_categories": [], "ambience_preferences": []}
        try:
<<<<<<< HEAD
            u_res = await _client.get(f"{USER_SERVICE_URL}/users/{uid}", headers=propagate_headers({"X-Tenant-Id": tenant_id}))
=======
            u_res = await _client.get(f"{USER_SERVICE_URL}/users/{uid}", headers={"X-Tenant-Id": tenant_id})
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
            if u_res.status_code == 200:
                p = u_res.json()
                user_dict["budget_min"] = p.get("budget_min", 0)
                user_dict["budget_max"] = p.get("budget_max", 4)
                user_dict["preferred_categories"] = p.get("preferred_categories") or []
                user_dict["ambience_preferences"] = p.get("ambience_preferences") or []
        except Exception:
            pass

        # CBF for this user
        cbf_map = scoring.cbf_scores(user_dict, [p for p, _ in candidates]) if (user_dict["preferred_categories"] or user_dict["ambience_preferences"]) else {}

        # Predict ML features
        feat_rows = []
        for place, dist in candidates:
            cbf_val = cbf_map.get(place["id"], float(place.get("rating") or 3.5) / 5.0)
            feat_rows.append(build_feature_vector(
                place={**place, "distance_km": dist},
                context=env_context,
                user=user_dict,
                cbf_score=cbf_val,
                cf_score=0.0,
            ))
        user_ml_preds = model_manager.predict_batch(feat_rows)

        scores_per_user[uid] = {}
        for idx, (place, dist) in enumerate(candidates):
            ml_s = user_ml_preds[idx] if idx < len(user_ml_preds) else 0.5
            cbf_val = cbf_map.get(place["id"], float(place.get("rating") or 3.5) / 5.0)
            ctx_s, _ = scoring.context_score(
                place, env_context, user=user_dict, outing_type=body.outing_type or "friends", budget_override=body.budget
            )
            components = {
                "content": cbf_val,
                "collaborative": 0.0,
                "ml": ml_s,
                "context": ctx_s,
                "distance": _distance_score(dist, radius),
                "popularity": float(place.get("popularity_score") or 0.5),
                "sentiment": float(place.get("sentiment_score") or 0.5),
            }
            fused, _, _ = fuse_candidate(place, components, occasion=body.occasion, n_positive_interactions=0)
            scores_per_user[uid][place["id"]] = fused

    # Aggregate using consensus strategy
    aggregated = scoring.aggregate_group_scores(scores_per_user, method=body.strategy)

    # Sort candidates by group consensus score
    ranked_places = []
    for pid, group_score in sorted(aggregated.items(), key=lambda kv: kv[1], reverse=True):
        if pid not in place_map:
            continue
        place, dist = place_map[pid]
        user_scores = {str(uid): round(scores_per_user[uid].get(pid, 0.0), 3) for uid in body.user_ids}
        min_user_score = min(user_scores.values()) if user_scores else 0.0

        reasons = [f"Group consensus ({body.strategy.replace('_', ' ')})"]
        if min_user_score >= 0.7:
            reasons.append("High satisfaction across all group members")

        ranked_places.append({
            "place": place,
            "score": round(group_score, 4),
            "distance_km": round(dist, 2),
            "user_scores": user_scores,
            "lowest_satisfaction": min_user_score,
            "reasons": reasons,
        })

    limit = max(1, min(body.limit, 50))
    return {
        "recommendations": ranked_places[:limit],
        "group_strategy": body.strategy,
        "user_ids": body.user_ids,
        "candidate_count": len(ranked_places),
    }

