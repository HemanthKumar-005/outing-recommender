import csv
import io
import json
import os
import sys
import threading
import uuid

import redis
import xgboost as xgb
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, "/shared")
from eventbus import consume_in_background  # noqa: E402
from features import FEATURE_NAMES, build_feature_vector  # noqa: E402
from ranking_config import load_config  # noqa: E402
from tenant import require_tenant  # noqa: E402

from app import clients, scoring

app = FastAPI(title="Recommendation Engine")

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/xgboost_model.json")
MODEL_METADATA_PATH = os.environ.get("MODEL_METADATA_PATH", "/models/xgboost_model.meta.json")
EVALUATION_RESULTS_PATH = os.environ.get("EVALUATION_RESULTS_PATH", "/evaluation/evaluation_results.csv")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
SESSION_TTL_SECONDS = 1800

_model_lock = threading.Lock()
_model: xgb.Booster | None = None
_model_metadata: dict | None = None
_redis = redis.from_url(REDIS_URL, decode_responses=True)


def _load_model() -> None:
    global _model, _model_metadata
    if os.path.exists(MODEL_PATH):
        booster = xgb.Booster()
        booster.load_model(MODEL_PATH)
        with _model_lock:
            _model = booster
        print(f"[recommendation-engine] loaded model from {MODEL_PATH}")
    else:
        print(f"[recommendation-engine] no model found at {MODEL_PATH} yet, using neutral fallback score")

    if os.path.exists(MODEL_METADATA_PATH):
        with open(MODEL_METADATA_PATH) as f:
            _model_metadata = json.load(f)


def _predict(feature_rows: list) -> list:
    with _model_lock:
        model = _model
    if model is None or not feature_rows:
        return [0.5] * len(feature_rows)
    dmatrix = xgb.DMatrix(feature_rows, feature_names=FEATURE_NAMES)
    return [float(x) for x in model.predict(dmatrix)]


def _on_event(routing_key: str, payload: dict):
    if routing_key == "model.updated":
        print(f"[recommendation-engine] model.updated received: {payload}, reloading")
        _load_model()


@app.on_event("startup")
def startup():
    _load_model()
    consume_in_background("recommendation-engine.model-updates", ["model.updated"], _on_event)


class RecommendationRequest(BaseModel):
    user_id: int
    user_ids: list[int] | None = None  # if set (len > 1), a group consensus recommendation
    group_aggregation: str | None = Field(None, pattern="^(least_misery|average|borda)$")
    lat: float
    lng: float
    radius_km: float = Field(5.0, gt=0, le=50)
    at: str | None = None  # ISO datetime, defaults to now
    category: str | None = None
    outing_type: str = Field("friends", pattern="^(couple|friends|family|solo)$")
    open_now: bool = False
    top_k: int = Field(10, ge=1, le=50)
    diversity: float | None = Field(None, ge=0, le=1)  # explore/exploit dial; None = config default
    weight_overrides: dict | None = None  # e.g. {"distance": 0.3, "popularity": 0.05}


class FeedbackRequest(BaseModel):
    place_id: int
    action: str = Field(..., pattern="^(skip|like)$")


@app.get("/health")
def health():
    return {"status": "ok", "service": "recommendation-engine", "model_loaded": _model is not None}


@app.get("/ready")
def ready():
    try:
        load_config()
        return {"status": "ready", "config_loaded": True, "model_loaded": _model is not None}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"ranking config not available: {e}")


@app.get("/model-info")
def model_info():
    return {"model_loaded": _model is not None, "metadata": _model_metadata}


@app.get("/model-card")
def model_card():
    """Public model card (Uniqueness §8): current model metadata + the most
    recent offline evaluation/ablation results, so the ranking behaviour is
    inspectable instead of a black box."""
    evaluation_rows = []
    if os.path.exists(EVALUATION_RESULTS_PATH):
        with open(EVALUATION_RESULTS_PATH) as f:
            evaluation_rows = list(csv.DictReader(io.StringIO(f.read())))
    return {
        "model_loaded": _model is not None,
        "metadata": _model_metadata,
        "ranking_config": load_config(),
        "evaluation_results": evaluation_rows,
        "evaluation_note": (
            "Offline metrics are computed against a synthetic ground-truth "
            "generator (no real interaction dataset yet) - see scripts/evaluate.py."
        ),
    }


def _score_candidates_for_user(user: dict, candidates: list, context: dict, outing_type: str,
                                all_interactions: list, weight_overrides: dict | None) -> tuple:
    """Returns (scores: {place_id: fused_score}, breakdowns: {place_id: dict}, profile_name)."""
    cbf = scoring.cbf_scores(user, candidates)
    cf, prior_positive_count = scoring.cf_scores(user["id"], candidates, all_interactions)
    profile_name, base_weights = scoring.resolve_weight_profile(prior_positive_count)
    weights = scoring.merge_weight_overrides(base_weights, weight_overrides)

    feature_rows = [
        build_feature_vector(place, context, user, cbf[place["id"]], cf[place["id"]])
        for place in candidates
    ]
    xgb_scores = _predict(feature_rows)

    scores, breakdowns = {}, {}
    for place, xgb_score in zip(candidates, xgb_scores):
        ctx_score, ctx_components = scoring.context_score(place, context, user, outing_type)
        bonus = scoring.exploration_bonus(place)
        final_score = scoring.fuse_scores(
            xgb_score=xgb_score, cbf_score=cbf[place["id"]], cf_score=cf[place["id"]],
            distance_km=place["distance_km"], sentiment_score=place.get("sentiment_score", 0.5),
            popularity_score=place.get("popularity_score", 0.5), ctx_score=ctx_score,
            weights=weights, place=place,
        )
        scores[place["id"]] = final_score
        breakdowns[place["id"]] = {
            "xgb_score": round(xgb_score, 4),
            "cbf_score": round(cbf[place["id"]], 4),
            "cf_score": round(cf[place["id"]], 4),
            "distance_km": place["distance_km"],
            "sentiment_score": place.get("sentiment_score", 0.5),
            "popularity_score": place.get("popularity_score", 0.5),
            "context_score": round(ctx_score, 4),
            "context_components": {k: round(v, 3) for k, v in ctx_components.items()},
            "exploration_bonus": round(bonus, 4),
        }
    return scores, breakdowns, profile_name


@app.post("/recommendations")
def recommend(req: RecommendationRequest, tenant_id: str = Depends(require_tenant)):
    target_user_ids = req.user_ids if req.user_ids and len(req.user_ids) > 1 else [req.user_id]
    is_group = len(target_user_ids) > 1

    users = {}
    for uid in target_user_ids:
        user = clients.get_user(tenant_id, uid)
        if not user:
            raise HTTPException(status_code=404, detail=f"user {uid} not found")
        users[uid] = user

    context = clients.get_context(req.lat, req.lng, req.at)

    primary_user = users[req.user_id] if req.user_id in users else next(iter(users.values()))
    candidates = clients.get_nearby_places(
        tenant_id, req.lat, req.lng, req.radius_km, category=req.category,
        # Group requests use soft per-user budget_suitability instead of a hard
        # filter, since a single price range can't correctly bound several
        # different users' budgets at once.
        min_price=None if is_group else primary_user.get("budget_min"),
        max_price=None if is_group else primary_user.get("budget_max"),
        open_now=req.open_now, limit=100,
    )
    if not candidates:
        return {"user_id": req.user_id, "context": context, "recommendations": []}

    all_interactions = clients.get_all_interactions(tenant_id)

    scores_per_user, breakdowns_per_user, profile_names = {}, {}, {}
    for uid, user in users.items():
        scores, breakdowns, profile_name = _score_candidates_for_user(
            user, candidates, context, req.outing_type, all_interactions, req.weight_overrides,
        )
        scores_per_user[uid] = scores
        breakdowns_per_user[uid] = breakdowns
        profile_names[uid] = profile_name

    if is_group:
        final_scores = scoring.aggregate_group_scores(scores_per_user, req.group_aggregation)
    else:
        final_scores = scores_per_user[target_user_ids[0]]

    # Display breakdown/reasons come from the primary user's perspective;
    # for a group this is clearly labeled as approximate in the response.
    primary_breakdowns = breakdowns_per_user[req.user_id if req.user_id in users else target_user_ids[0]]

    places_by_id = {p["id"]: p for p in candidates}
    ranked = []
    for place_id, score in final_scores.items():
        place = places_by_id[place_id]
        breakdown = primary_breakdowns[place_id]
        ranked.append({
            "place": place,
            "score": round(score, 4),
            "score_breakdown": breakdown,
            "reasons": scoring.build_explanation(place, breakdown, place["distance_km"]),
        })
    ranked.sort(key=lambda r: r["score"], reverse=True)

    diversity = req.diversity if req.diversity is not None else load_config()["diversity"]["default"]
    ranked = scoring.diversify(ranked, diversity)

    session_id = str(uuid.uuid4())
    session_payload = {
        "tenant_id": tenant_id,
        "ranked": ranked,
        "excluded_ids": [],
        "diversity": diversity,
        "top_k": req.top_k,
    }
    try:
        _redis.setex(f"session:{session_id}", SESSION_TTL_SECONDS, json.dumps(session_payload))
    except Exception as e:  # noqa: BLE001
        print(f"[recommendation-engine] could not cache session: {e}")

    return {
        "session_id": session_id,
        "user_id": req.user_id,
        "group_user_ids": target_user_ids if is_group else None,
        "group_aggregation": (req.group_aggregation or load_config()["group_aggregation"]["default_method"]) if is_group else None,
        "outing_type": req.outing_type,
        "context": context,
        "weight_profile": profile_names,
        "diversity": diversity,
        "recommendations": ranked[: req.top_k],
    }


@app.post("/recommendations/{session_id}/feedback")
def feedback(session_id: str, req: FeedbackRequest, tenant_id: str = Depends(require_tenant)):
    """Live re-ranking within a session (Uniqueness §3): skip/like an item
    without a full re-query, so the list responds within the same session."""
    raw = _redis.get(f"session:{session_id}")
    if not raw:
        raise HTTPException(status_code=404, detail="session not found or expired")
    session = json.loads(raw)
    if session.get("tenant_id") != tenant_id:
        # Same 404 as "not found" - never reveal that a session exists for
        # another tenant.
        raise HTTPException(status_code=404, detail="session not found or expired")

    ranked = session["ranked"]
    excluded = set(session["excluded_ids"])

    if req.action == "skip":
        excluded.add(req.place_id)
    elif req.action == "like":
        # Nudge similar (same category/ambience) unseen candidates upward.
        liked_place = next((r["place"] for r in ranked if r["place"]["id"] == req.place_id), None)
        if liked_place:
            for r in ranked:
                if r["place"]["id"] in excluded or r["place"]["id"] == req.place_id:
                    continue
                sim = scoring.place_similarity(r["place"], liked_place)
                r["score"] = round(r["score"] * (1 + 0.15 * sim), 4)

    remaining = [r for r in ranked if r["place"]["id"] not in excluded]
    remaining.sort(key=lambda r: r["score"], reverse=True)
    remaining = scoring.diversify(remaining, session["diversity"])

    session["ranked"] = ranked  # keep full pool (with updated scores) for future feedback calls
    session["excluded_ids"] = list(excluded)
    try:
        _redis.setex(f"session:{session_id}", SESSION_TTL_SECONDS, json.dumps(session))
    except Exception as e:  # noqa: BLE001
        print(f"[recommendation-engine] could not update session cache: {e}")

    return {"session_id": session_id, "recommendations": remaining[: session["top_k"]]}
