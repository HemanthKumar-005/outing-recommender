import math
import os
import sys
from datetime import datetime
from pathlib import Path

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break
from ranking_config import load_config  # noqa: E402


def _vector_for_place(place: dict, all_categories: list, all_ambience: list) -> list:
    cat_vec = [1.0 if place.get("category") == c else 0.0 for c in all_categories]
    place_ambience = set(place.get("ambience", []))
    amb_vec = [1.0 if a in place_ambience else 0.0 for a in all_ambience]
    return cat_vec + amb_vec


def _vector_for_user(user: dict, all_categories: list, all_ambience: list) -> list:
    preferred = set(user.get("preferred_categories", []))
    cat_vec = [1.0 if c in preferred else 0.0 for c in all_categories]
    amb_pref = set(user.get("ambience_preferences", []))
    amb_vec = [1.0 if a in amb_pref else 0.0 for a in all_ambience]
    return cat_vec + amb_vec


def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def cbf_scores(user: dict, places: list) -> dict:
    """Content-based filtering score per place_id (Review §7): cosine
    similarity between a user preference vector and each place's vector,
    over a category + ambience one-hot space built from the candidate set."""
    all_categories = sorted({p["category"] for p in places} | set(user.get("preferred_categories", [])))
    all_ambience = sorted({a for p in places for a in p.get("ambience", [])} | set(user.get("ambience_preferences", [])))

    user_vec = _vector_for_user(user, all_categories, all_ambience)
    scores = {}
    for place in places:
        place_vec = _vector_for_place(place, all_categories, all_ambience)
        scores[place["id"]] = cosine_similarity(user_vec, place_vec)
    return scores


def matrix_factorization_scores(user_id: int, places: list, all_interactions: list, k: int = 8) -> dict[int, float]:
    """Compute dense latent factor user-item affinities using TruncatedSVD Matrix Factorization.
    Generates k-dimensional latent embeddings for users and places to support
    cross-category serendipitous discovery."""
    if not all_interactions or not places:
        return {p["id"]: 0.0 for p in places}

    try:
        import numpy as np
        from sklearn.decomposition import TruncatedSVD

        user_ids = sorted(list({int(it["user_id"]) for it in all_interactions if "user_id" in it}))
        place_ids = sorted(list({int(it["place_id"]) for it in all_interactions if "place_id" in it}))

        if user_id not in user_ids or len(user_ids) < 2 or len(place_ids) < 2:
            return {p["id"]: 0.0 for p in places}

        u_map = {u: idx for idx, u in enumerate(user_ids)}
        p_map = {p: idx for idx, p in enumerate(place_ids)}

        R = np.zeros((len(user_ids), len(place_ids)), dtype=np.float32)
        weight_map = {
            "save": 3.0,
            "visit": 4.0,
            "share": 2.5,
            "like": 3.0,
            "view": 1.0,
            "click": 1.0,
            "skip": -0.5,
        }
        for it in all_interactions:
            uid = it.get("user_id")
            pid = it.get("place_id")
            if uid in u_map and pid in p_map:
                itype = it.get("type") or it.get("event_type")
                rating = it.get("rating")
                if rating is not None and itype == "rating":
                    w = float(rating)
                else:
                    w = weight_map.get(itype, 2.0)
                R[u_map[uid], p_map[pid]] += w

        n_components = max(1, min(k, len(user_ids) - 1, len(place_ids) - 1))
        svd = TruncatedSVD(n_components=n_components, random_state=42)
        user_factors = svd.fit_transform(R)
        item_factors = svd.components_.T

        user_vec = user_factors[u_map[user_id]]
        user_norm = float(np.linalg.norm(user_vec))
        if user_norm == 0.0:
            return {p["id"]: 0.0 for p in places}

        scores = {}
        for place in places:
            pid = place.get("id")
            if pid in p_map:
                p_vec = item_factors[p_map[pid]]
                p_norm = float(np.linalg.norm(p_vec))
                if p_norm > 0:
                    cos_sim = float(np.dot(user_vec, p_vec) / (user_norm * p_norm))
                    # Only positive cosine similarity represents positive latent affinity
                    scores[pid] = max(0.0, min(1.0, cos_sim)) if cos_sim > 0.0 else 0.0
                else:
                    scores[pid] = 0.0
            else:
                scores[pid] = 0.0
        return scores
    except Exception:
        return {p["id"]: 0.0 for p in places}


def cf_scores(user_id: int, places: list, all_interactions: list) -> tuple:
    """Lightweight item-based collaborative filtering via co-occurrence overlap
    (Review §8). For a candidate place p, the score is the fraction of users
    who liked p who also liked at least one place the target user already likes.
    Returns (scores_dict, prior_positive_interaction_count)."""
    place_to_users: dict = {}
    for it in all_interactions:
        if it.get("type") in ("save", "visit", "rating", "share", "like"):
            place_to_users.setdefault(it["place_id"], set()).add(it["user_id"])

    user_liked_places = {
        it["place_id"] for it in all_interactions
        if it["user_id"] == user_id and it.get("type") in ("save", "visit", "rating", "share", "like")
    }
    users_who_like_similar_places: set = set()
    for pid in user_liked_places:
        users_who_like_similar_places |= place_to_users.get(pid, set())
    users_who_like_similar_places.discard(user_id)

    scores = {}
    for place in places:
        users_p = place_to_users.get(place["id"], set())
        if not users_p or not users_who_like_similar_places:
            scores[place["id"]] = 0.0
            continue
        overlap = len(users_p & users_who_like_similar_places)
        scores[place["id"]] = overlap / len(users_p)
    return scores, len(user_liked_places)


# ---------------------------------------------------------------------------
# Context score components (Review §13, §14, §17): weather should change the
# recommendation, not just be displayed, so these feed the ranking directly
# in addition to being XGBoost features.
# ---------------------------------------------------------------------------

def weather_suitability(place: dict, context: dict) -> float:
    """Dynamic context-aware weather & temperature suitability scoring.
    Penalizes outdoor venues in rain and temperature extremes (>38°C heatwave or <8°C cold).
    Favors AC indoor venues during peak afternoon heat and outdoor/rooftop venues during
    pleasant evening golden hours."""
    weather = context.get("weather", {}) or {}
    condition = weather.get("condition")
    temp_c = weather.get("temp_c")
    time_of_day = context.get("time_of_day")
    if not time_of_day and context.get("datetime"):
        try:
            h = datetime.fromisoformat(context["datetime"]).hour
            time_of_day = "morning" if 5 <= h < 11 else ("afternoon" if 11 <= h < 17 else ("evening" if 17 <= h < 21 else "night"))
        except Exception:
            time_of_day = "afternoon"

    indoor_outdoor = place.get("indoor_outdoor", "indoor")
    tags = set(place.get("tags") or [])
    ambience = set(place.get("ambience") or [])

    # 1. Rainy / Precipitation condition
    if condition == "rain":
        if indoor_outdoor == "outdoor":
            return 0.15
        if indoor_outdoor == "both":
            return 0.55
        return 0.95  # indoor venue is comfortable and sheltered

    # 2. Extreme Heatwave (> 38°C)
    if temp_c is not None and temp_c >= 38.0:
        if indoor_outdoor == "outdoor":
            return 0.15  # unsafe/stifling heat outdoors
        if indoor_outdoor == "both":
            return 0.45
        return 0.95  # air-conditioned indoor haven

    # 3. High Heat (33°C - 38°C)
    if temp_c is not None and temp_c >= 33.0:
        if indoor_outdoor == "outdoor":
            return 0.30 if time_of_day == "afternoon" else 0.55
        if indoor_outdoor == "both":
            return 0.60
        return 0.92  # indoor AC preferred

    # 4. Extreme Cold (< 8°C)
    if temp_c is not None and temp_c < 8.0:
        if indoor_outdoor == "outdoor":
            return 0.25
        if indoor_outdoor == "both":
            return 0.55
        return 0.95  # heated/cozy indoor space

    # 5. Pleasant / Mild / Clear Weather (8°C - 32°C)
    if indoor_outdoor == "outdoor":
        # Evening golden hour boost for outdoor, rooftop, and scenic venues
        if time_of_day == "evening":
            if "rooftop" in tags or "scenic" in ambience:
                return 1.0
            return 0.95
        if time_of_day == "afternoon" and temp_c is not None and temp_c > 29.0:
            return 0.75  # slightly warm afternoon
        return 0.90

    if indoor_outdoor == "both":
        return 0.90

    # Indoor places in pleasant weather
    if time_of_day == "afternoon":
        return 0.88  # good daytime cafe / activity
    return 0.82



from hours_pricing import evaluate_place_hours  # noqa: E402


def time_suitability(place: dict, context: dict) -> float:
    """Soft score for how comfortably a place fits the requested time.
    Uses real weekly opening hours evaluated in Asia/Kolkata time."""
    ref_dt = None
    if context.get("datetime"):
        try:
            ref_dt = datetime.fromisoformat(context["datetime"])
        except Exception:
            pass

    eval_res = evaluate_place_hours(place.get("opening_hours"), ref_dt=ref_dt)
    open_now = eval_res.get("open_now")
    if open_now is None:
        return 0.85  # Hours unavailable: neutral-good, never penalized as closed
    if open_now is True:
        closes_in = eval_res.get("closes_in_minutes")
        if closes_in is not None and closes_in < 30:
            return 0.4
        if closes_in is not None and closes_in < 60:
            return 0.75
        return 1.0
    # Currently closed
    if eval_res.get("opens_at"):
        return 0.5  # opens later today
    return 0.2  # closed today


def budget_suitability(place: dict, user: dict, budget_override: str | None = None) -> float:
    cost_for_two = place.get("cost_for_two") or place.get("average_cost")
    price_tier = place.get("price_range", 2)

    budget_choice = (budget_override or "").lower()
    if budget_choice in ("low", "budget"):
        if cost_for_two is not None:
            return 1.0 if cost_for_two <= 800 else max(0.2, 1.0 - (cost_for_two - 800) / 1200)
        return 1.0 if price_tier <= 1 else max(0.2, 1.0 - 0.4 * (price_tier - 1))
    elif budget_choice in ("medium", "standard", "moderate"):
        if cost_for_two is not None:
            if 400 <= cost_for_two <= 2200:
                return 1.0
            return max(0.3, 1.0 - abs(cost_for_two - 1200) / 2000)
        return 1.0 if price_tier in (2, 3) else 0.6
    elif budget_choice in ("high", "premium", "luxury"):
        if cost_for_two is not None:
            return 1.0 if cost_for_two >= 1800 else max(0.3, cost_for_two / 1800)
        return 1.0 if price_tier >= 3 else 0.5

    budget_min = user.get("budget_min", 0) if user else 0
    budget_max = user.get("budget_max", 4) if user else 4
    if budget_min <= price_tier <= budget_max:
        return 1.0
    distance = min(abs(price_tier - budget_min), abs(price_tier - budget_max))
    return max(0.0, 1.0 - 0.35 * distance)


def group_suitability(place: dict, outing_type: str) -> float:
    flag_map = {
        "couple": "couple_friendly",
        "family": "family_friendly",
        "friends": "friends_friendly",
        "solo": None,  # no specific place flag - solo outings fit most places
    }
    flag = flag_map.get(outing_type)
    if flag is None:
        return 0.8
    return 1.0 if place.get(flag) else 0.5


def context_score(place: dict, context: dict, user: dict, outing_type: str, budget_override: str | None = None) -> tuple:
    """ContextScore = a*Weather + b*Time + c*Budget + d*Group (Review §17)."""
    sub = load_config()["context_subweights"]
    weather = weather_suitability(place, context)
    time_s = time_suitability(place, context)
    budget = budget_suitability(place, user, budget_override=budget_override)
    group = group_suitability(place, outing_type)
    score = sub["weather"] * weather + sub["time"] * time_s + sub["budget"] * budget + sub["group"] * group
    return score, {"weather": weather, "time": time_s, "budget": budget, "group": group}


def resolve_weight_profile(prior_positive_interaction_count: int) -> tuple:
    """Cold-start strategy (Review §9): a user with too little interaction
    history gets a profile that excludes collaborative filtering so CF can't
    become a blocking dependency. Returns (profile_name, weights_dict)."""
    cfg = load_config()
    threshold = cfg["cold_start"]["min_interactions_for_cf"]
    if prior_positive_interaction_count < threshold:
        return "new_user", dict(cfg["profiles"]["new_user"])
    return "existing_user", dict(cfg["profiles"]["existing_user"])


def merge_weight_overrides(base_weights: dict, overrides: dict | None) -> dict:
    """User-adjustable weights (Uniqueness §5): lets the frontend expose real
    sliders for 'care more about distance, less about popularity' instead of
    a black-box score. Overrides are clamped to [0, 1] then the whole set is
    renormalized so the fused score stays on a comparable 0-1-ish scale."""
    if not overrides:
        return base_weights
    merged = dict(base_weights)
    for key, value in overrides.items():
        if key in merged and isinstance(value, (int, float)):
            merged[key] = max(0.0, min(1.0, float(value)))
    total = sum(merged.values())
    if total > 0:
        merged = {k: v / total for k, v in merged.items()}
    return merged


def exploration_bonus(place: dict) -> float:
    """Place-side cold start (Uniqueness §7): a small UCB-style boost for
    low-review-count places so new/under-reviewed venues aren't permanently
    buried under already-popular ones."""
    cfg = load_config()["place_exploration"]
    review_count = place.get("review_count") or 0
    if review_count >= cfg["review_count_ceiling"]:
        return 0.0
    bonus = cfg["strength"] / math.sqrt(review_count + 1)
    return min(bonus, cfg["max_bonus"])


def fuse_scores(xgb_score: float, cbf_score: float, cf_score: float,
                distance_km: float, sentiment_score: float, popularity_score: float,
                ctx_score: float, weights: dict, place: dict | None = None) -> float:
    distance_score = max(0.0, 1.0 - min(distance_km, 20.0) / 20.0)
    base = (
        weights["ml"] * xgb_score
        + weights["content"] * cbf_score
        + weights["collaborative"] * cf_score
        + weights["distance"] * distance_score
        + weights["sentiment"] * sentiment_score
        + weights["popularity"] * popularity_score
        + weights["context"] * ctx_score
    )
    if place is not None:
        base += exploration_bonus(place)
    return base


def build_explanation(place: dict, breakdown: dict, distance_km: float) -> list:
    """Explainable recommendations (Review §33): a short list of ✓ reasons."""
    reasons = []
    ctx = breakdown.get("context_components") or {}

    # Opening hours reasons
    hours_detail = place.get("hours_detail") or ""
    open_now = place.get("open_now")
    if open_now is True:
        if "Open until" in hours_detail:
            reasons.append(hours_detail)
        elif "Closes in" in hours_detail:
            reasons.append(hours_detail)
        else:
            reasons.append("Open now")
    elif open_now is False and hours_detail and "Opens" in hours_detail:
        reasons.append(hours_detail)

    # Cost for two / Entry fee reason
    cost_val = place.get("cost_for_two") or place.get("average_cost")
    is_est = place.get("pricing_is_estimated", True)
    approx = "~" if is_est else ""
    if cost_val is not None and cost_val > 0:
        reasons.append(f"{approx}₹{int(cost_val)} for two")
    elif place.get("entry_fee", 0) > 0:
        reasons.append(f"Entry ₹{int(place['entry_fee'])}")
    elif cost_val == 0:
        reasons.append("Free entry")

    if ctx.get("budget", 0) >= 0.99:
        reasons.append("Within your budget")
    if breakdown.get("cbf_score", 0) >= 0.5:
        reasons.append("High match with your preferences")
    if ctx.get("weather", 0) >= 0.8:
        reasons.append("Good fit for current weather")
    if distance_km <= 3:
        reasons.append(f"Only {distance_km:.1f} km away")
    if place.get("rating") and place["rating"] >= 4.0:
        reasons.append(f"Highly rated ({place['rating']}/5)")
    if breakdown.get("cf_score", 0) >= 0.3:
        reasons.append("Popular with similar users")
    if place.get("sentiment_score", 0) >= 0.7:
        reasons.append("Positive reviews")
    if ctx.get("group", 0) >= 0.99:
        reasons.append("Well-suited for this outing type")
    if breakdown.get("ml", 0) >= 0.65:
        reasons.append("Strong match predicted by AI model")
    if breakdown.get("exploration_bonus", 0) > 0.02:
        reasons.append("Rising / under-the-radar pick")
    if not reasons:
        reasons.append("Reasonable overall match")
    return reasons


# ---------------------------------------------------------------------------
# Group consensus (Uniqueness §1): combine per-user fused scores for a shared
# outing so one person's taste doesn't quietly dominate the group's picks.
# ---------------------------------------------------------------------------

def aggregate_group_scores(scores_per_user: dict, method: str | None = None) -> dict:
    """scores_per_user: {user_id: {place_id: fused_score}}. Returns {place_id: group_score}."""
    cfg = load_config()
    method = method or cfg["group_aggregation"]["default_method"]
    place_ids = set()
    for per_place in scores_per_user.values():
        place_ids |= set(per_place.keys())

    if method == "least_misery":
        return {pid: min(u.get(pid, 0.0) for u in scores_per_user.values()) for pid in place_ids}

    if method == "average":
        return {
            pid: sum(u.get(pid, 0.0) for u in scores_per_user.values()) / len(scores_per_user)
            for pid in place_ids
        }

    if method == "borda":
        # Rank each user's places (1 = best), average the ranks, then invert
        # so a lower average rank produces a higher group score.
        rank_sums: dict = {pid: 0.0 for pid in place_ids}
        for per_place in scores_per_user.values():
            ordered = sorted(per_place.items(), key=lambda kv: kv[1], reverse=True)
            for rank, (pid, _score) in enumerate(ordered, start=1):
                rank_sums[pid] += rank
        max_rank = len(place_ids) * len(scores_per_user)
        return {pid: 1.0 - (rank_sum / max_rank) for pid, rank_sum in rank_sums.items()}

    raise ValueError(f"unknown group_aggregation method: {method}")


# ---------------------------------------------------------------------------
# Explore/exploit re-ranking (Uniqueness §2): a greedy diversity pass akin to
# Maximal Marginal Relevance - at each step, pick the highest-scoring
# candidate that isn't too similar to what's already been picked.
# ---------------------------------------------------------------------------

def _place_similarity(a: dict, b: dict, cfg: dict) -> float:
    category_sim = 1.0 if a.get("category") == b.get("category") else 0.0
    amb_a, amb_b = set(a.get("ambience", [])), set(b.get("ambience", []))
    if amb_a or amb_b:
        ambience_sim = len(amb_a & amb_b) / len(amb_a | amb_b)
    else:
        ambience_sim = 0.0
    return (
        cfg["category_similarity_weight"] * category_sim
        + cfg["ambience_similarity_weight"] * ambience_sim
    )


def place_similarity(a: dict, b: dict) -> float:
    """Public wrapper around the internal similarity metric, for use outside
    the diversify() re-ranking pass (e.g. the like-feedback nudge)."""
    return _place_similarity(a, b, load_config()["diversity"])


def diversify(ranked: list, diversity: float) -> list:
    """ranked: list of dicts each with a "place" key and a "score" key,
    already sorted by score descending. diversity in [0, 1]; 0 returns the
    input unchanged (pure relevance ranking), higher values increasingly
    favor variety over the raw score."""
    if diversity <= 0 or len(ranked) <= 2:
        return ranked

    cfg = load_config()["diversity"]
    remaining = ranked.copy()
    selected: list = [remaining.pop(0)]  # always keep the top relevance pick first

    while remaining:
        best_idx, best_value = 0, float("-inf")
        for i, candidate in enumerate(remaining):
            max_sim = max(
                _place_similarity(candidate["place"], s["place"], cfg) for s in selected
            )
            mmr_value = (1 - diversity) * candidate["score"] - diversity * max_sim
            if mmr_value > best_value:
                best_idx, best_value = i, mmr_value
        selected.append(remaining.pop(best_idx))

    return selected
