"""
Model training worker for Outing Recommender.

Supports:
1. Extracting historical user-place interaction logs from PostgreSQL via DATABASE_URL.
2. Binary preference labeling:
   - Positive (1): visit, save, share, rating >= 4.0
   - Negative (0): skip, rating <= 2.0
   - Neutral (ignored): view, click, rating == 3.0
3. Chronological, leakage-free feature computation using shared/features.py:
   - Popularity score using strictly prior positive interactions
   - Collaborative filtering (CF) co-occurrence overlap strictly prior to event
   - Content-based filtering (CBF) cosine similarity over categories and ambience
   - Context reconstruction (day of week, time of day, weather)
4. Temporal 80/20 train/validation split.
5. Automatic graceful fallback to synthetic dataset if usable real samples < 1,000 or single-class.
6. Saving model and schema-validated metadata to shared /models volume.
7. Publishing 'model.updated' event over RabbitMQ for zero-downtime hot reloading.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

try:
    # pyrefly: ignore [missing-import]
    from eventbus import publish  # noqa: E402
except ImportError:
    # Graceful fallback when running locally without RabbitMQ/pika
    def publish(routing_key: str, payload: dict) -> None:
        print(f"[eventbus-stub] publish {routing_key}: {payload}")

try:
    # pyrefly: ignore [missing-import]
    from features import FEATURE_NAMES, FEATURE_VERSION, build_feature_vector  # noqa: E402
except ImportError:
    FEATURE_NAMES = [
        "distance_km", "price_fit", "cbf_score", "cf_score", "sentiment_score",
        "popularity_score", "is_weekend", "is_evening_or_night", "temp_c_norm", "is_rainy",
    ]
    FEATURE_VERSION = "v1"

    def build_feature_vector(place: dict, context: dict, user: dict,
                              cbf_score: float, cf_score: float) -> list:
        distance_km = min(place.get("distance_km", 25.0), 50.0)
        budget_min = user.get("budget_min", 0)
        budget_max = user.get("budget_max", 4)
        price = place.get("price_range", 2)
        price_fit = 1.0 if budget_min <= price <= budget_max else 0.0
        sentiment_score = place.get("sentiment_score", 0.5)
        popularity_score = place.get("popularity_score", 0.5)
        is_weekend = 1.0 if context.get("is_weekend") else 0.0
        time_of_day = context.get("time_of_day", "afternoon")
        is_evening_or_night = 1.0 if time_of_day in ("evening", "night") else 0.0
        weather = context.get("weather", {}) or {}
        temp_c = weather.get("temp_c")
        temp_c_norm = max(0.0, min((temp_c if temp_c is not None else 22) / 40.0, 1.0))
        is_rainy = 1.0 if weather.get("condition") == "rain" else 0.0
        return [
            distance_km, price_fit, cbf_score, cf_score, sentiment_score,
            popularity_score, is_weekend, is_evening_or_night, temp_c_norm, is_rainy,
        ]

import numpy as np
# pyrefly: ignore [missing-import]
import xgboost as xgb
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/xgboost_model.json")
MODEL_METADATA_PATH = os.environ.get("MODEL_METADATA_PATH", "/models/xgboost_model.meta.json")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres_admin_pw@postgres:5432/outing")
FAIL_ON_DB_UNAVAILABLE = os.environ.get("FAIL_ON_DB_UNAVAILABLE", "false").lower() == "true"
MIN_REAL_SAMPLES = int(os.environ.get("MIN_REAL_SAMPLES", "1000"))
MODEL_NAME = "xgboost_recommender"
N_SAMPLES = int(os.environ.get("N_TRAIN_SAMPLES", "20000"))
SEED = int(os.environ.get("TRAIN_SEED", "42"))


# ---------------------------------------------------------------------------
# Helper functions for feature engineering & labeling
# ---------------------------------------------------------------------------

def ensure_json(val: Any, default: Any) -> Any:
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return default
    return default


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


def compute_cbf_score(
    user_preferred_cats: list[str],
    user_ambience_prefs: list[str],
    place_cat: str,
    place_ambience: list[str],
) -> float:
    pref_cats = set(user_preferred_cats or [])
    pref_amb = set(user_ambience_prefs or [])
    place_amb = set(place_ambience or [])

    cat_match = 1.0 if place_cat in pref_cats else 0.0
    amb_match = float(len(pref_amb & place_amb))
    dot = cat_match + amb_match

    norm_user = math.sqrt(len(pref_cats) + len(pref_amb))
    norm_place = math.sqrt(1.0 + len(place_amb))

    if norm_user == 0.0 or norm_place == 0.0:
        return 0.0
    return dot / (norm_user * norm_place)


def get_interaction_label(interaction_type: str, rating: float | None) -> int | None:
    """
    Classify interaction into binary labels:
      Positive (1): visit, save, share, rating >= 4.0
      Negative (0): skip, rating <= 2.0
      Neutral (None): view, click, rating == 3.0, or unrated neutral
    """
    itype = (interaction_type or "").lower().strip()
    if itype in ("visit", "save", "share"):
        return 1
    if itype == "rating":
        if rating is not None:
            if rating >= 4.0:
                return 1
            if rating <= 2.0:
                return 0
        return None
    if itype == "skip":
        return 0
    return None


def is_positive_interaction(interaction_type: str, rating: float | None) -> bool:
    itype = (interaction_type or "").lower().strip()
    if itype in ("visit", "save", "share"):
        return True
    if itype == "rating" and rating is not None and rating >= 4.0:
        return True
    return False


# ---------------------------------------------------------------------------
# Database extraction
# ---------------------------------------------------------------------------

INTERACTION_EXTRACT_QUERY = """
SELECT 
    i.id AS interaction_id,
    i.tenant_id,
    i.user_id,
    i.place_id,
    i.type,
    i.rating,
    i.context AS interaction_context,
    i.ts,
    p.category AS place_category,
    p.price_range AS place_price_range,
    p.rating AS place_rating,
    p.lat AS place_lat,
    p.lng AS place_lng,
    p.indoor_outdoor AS place_indoor_outdoor,
    p.ambience AS place_ambience,
    p.sentiment_score AS place_sentiment_score,
    p.popularity_score AS place_base_popularity,
    u.budget_min AS user_budget_min,
    u.budget_max AS user_budget_max,
    u.preferred_categories AS user_preferred_categories,
    u.ambience_preferences AS user_ambience_preferences,
    u.preferred_distance_km AS user_preferred_distance_km,
    u.home_lat AS user_home_lat,
    u.home_lng AS user_home_lng
FROM interactions.interactions i
JOIN places.places p ON i.place_id = p.id AND i.tenant_id = p.tenant_id
JOIN users.users u ON i.user_id = u.id AND i.tenant_id = u.tenant_id
ORDER BY i.ts ASC;
"""


def extract_interactions_from_db(database_url: str) -> list[dict]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(INTERACTION_EXTRACT_QUERY)
            rows = cur.fetchall()
            return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Leakage-free feature dataset builder
# ---------------------------------------------------------------------------

def build_dataset_from_interactions(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """
    Sequential processing of chronological interaction events.
    For each row at timestamp t:
      - Evaluates features strictly from historical state prior to t.
      - If labeled, appends feature vector and binary label.
      - If positive, updates historical state for subsequent rows.
    """
    user_liked_places: dict[int, set[int]] = {}
    place_to_users: dict[int, set[int]] = {}
    place_pos_counts: dict[int, int] = {}

    X_list: list[list[float]] = []
    y_list: list[int] = []

    for row in rows:
        user_id = row.get("user_id")
        place_id = row.get("place_id")
        itype = row.get("type")
        rating = row.get("rating")
        label = get_interaction_label(itype, rating)

        if label is not None:
            # 1. Content-based filtering score
            pref_cats = ensure_json(row.get("user_preferred_categories"), [])
            pref_amb = ensure_json(row.get("user_ambience_preferences"), [])
            place_cat = row.get("place_category") or ""
            place_amb = ensure_json(row.get("place_ambience"), [])
            cbf_score = compute_cbf_score(pref_cats, pref_amb, place_cat, place_amb)

            # 2. Collaborative filtering score strictly prior to t
            target_user_liked = user_liked_places.get(user_id, set())
            users_with_similar_taste: set[int] = set()
            for pid in target_user_liked:
                users_with_similar_taste |= place_to_users.get(pid, set())
            users_with_similar_taste.discard(user_id)

            users_p = place_to_users.get(place_id, set())
            if not users_p or not users_with_similar_taste:
                cf_score = 0.0
            else:
                overlap = len(users_p & users_with_similar_taste)
                cf_score = overlap / float(len(users_p))

            # 3. Popularity score strictly prior to t
            pos_count = place_pos_counts.get(place_id, 0)
            if pos_count > 0:
                popularity_score = min(1.0, math.log1p(pos_count) / math.log1p(25.0))
            else:
                base_pop = row.get("place_base_popularity")
                popularity_score = float(base_pop) if base_pop is not None else 0.5

            # 4. Distance calculation
            u_lat = row.get("user_home_lat")
            u_lng = row.get("user_home_lng")
            p_lat = row.get("place_lat")
            p_lng = row.get("place_lng")
            if u_lat is not None and u_lng is not None and p_lat is not None and p_lng is not None:
                dist_km = haversine(float(u_lat), float(u_lng), float(p_lat), float(p_lng))
            else:
                pref_dist = row.get("user_preferred_distance_km")
                dist_km = float(pref_dist) if pref_dist is not None else 10.0

            # 5. Context reconstruction
            ts = row.get("ts")
            raw_ctx = ensure_json(row.get("interaction_context"), {})
            if isinstance(raw_ctx, dict):
                ctx_dict = raw_ctx
            else:
                ctx_dict = {}

            is_weekend = ctx_dict.get("is_weekend")
            if is_weekend is None and ts is not None and hasattr(ts, "weekday"):
                is_weekend = (ts.weekday() >= 5)

            time_of_day = ctx_dict.get("time_of_day")
            if not time_of_day and ts is not None and hasattr(ts, "hour"):
                hour = ts.hour
                if 5 <= hour < 12:
                    time_of_day = "morning"
                elif 12 <= hour < 17:
                    time_of_day = "afternoon"
                elif 17 <= hour < 22:
                    time_of_day = "evening"
                else:
                    time_of_day = "night"

            weather = ctx_dict.get("weather") or {"temp_c": 22.0, "condition": "clear"}

            context_dict = {
                "is_weekend": bool(is_weekend),
                "time_of_day": time_of_day or "afternoon",
                "weather": weather,
            }

            place_dict = {
                "distance_km": dist_km,
                "price_range": row.get("place_price_range", 2),
                "sentiment_score": row.get("place_sentiment_score", 0.5),
                "popularity_score": popularity_score,
            }

            user_dict = {
                "budget_min": row.get("user_budget_min", 0),
                "budget_max": row.get("user_budget_max", 4),
            }

            feature_vec = build_feature_vector(place_dict, context_dict, user_dict, cbf_score, cf_score)
            X_list.append(feature_vec)
            y_list.append(label)

        # AFTER feature computation, update historical state if positive
        if is_positive_interaction(itype, rating):
            user_liked_places.setdefault(user_id, set()).add(place_id)
            place_to_users.setdefault(place_id, set()).add(user_id)
            place_pos_counts[place_id] = place_pos_counts.get(place_id, 0) + 1

    if not X_list:
        return np.empty((0, len(FEATURE_NAMES)), dtype=np.float32), np.empty((0,), dtype=np.int32)

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int32)


def synthesize_dataset(n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    distance_km = rng.uniform(0, 20, n)
    price_fit = rng.integers(0, 2, n).astype(float)
    cbf_score = rng.uniform(0, 1, n)
    cf_score = rng.uniform(0, 1, n)
    sentiment_score = rng.uniform(0, 1, n)
    popularity_score = rng.uniform(0, 1, n)
    is_weekend = rng.integers(0, 2, n).astype(float)
    is_evening_or_night = rng.integers(0, 2, n).astype(float)
    temp_c_norm = rng.uniform(0.3, 0.9, n)
    is_rainy = rng.integers(0, 2, n).astype(float)

    X = np.column_stack([
        distance_km, price_fit, cbf_score, cf_score, sentiment_score,
        popularity_score, is_weekend, is_evening_or_night, temp_c_norm, is_rainy,
    ])

    logit = (
        -0.15 * distance_km
        + 1.1 * price_fit
        + 1.8 * cbf_score
        + 1.3 * cf_score
        + 1.0 * sentiment_score
        + 0.6 * popularity_score
        + 0.2 * is_weekend
        - 0.4 * is_rainy * is_evening_or_night
        + rng.normal(0, 0.5, n)
    )
    prob = 1.0 / (1.0 + np.exp(-logit))
    y = (rng.uniform(0, 1, n) < prob).astype(int)
    return X, y


# ---------------------------------------------------------------------------
# Training routine
# ---------------------------------------------------------------------------

def train() -> tuple[str, dict, str, str]:
    """
    Executes training workflow.
    Returns: (model_path, metrics, dataset_version, training_mode)
    """
    random.seed(SEED)
    raw_rows = None

    if DATABASE_URL:
        try:
            print(f"[model-training-worker] Connecting to database at {DATABASE_URL}...")
            raw_rows = extract_interactions_from_db(DATABASE_URL)
            print(f"[model-training-worker] Successfully extracted {len(raw_rows)} raw interaction rows from database.")
        except Exception as e:
            print(
                f"[model-training-worker] Database extraction failed: {e}",
                file=sys.stderr,
            )
            if FAIL_ON_DB_UNAVAILABLE:
                sys.exit(1)
            print(
                "[model-training-worker] Proceeding with synthetic fallback due to database unavailability.",
                file=sys.stderr,
            )

    X, y = np.empty((0, len(FEATURE_NAMES))), np.empty((0,))
    if raw_rows:
        X, y = build_dataset_from_interactions(raw_rows)

    num_samples = len(X)
    classes = np.unique(y) if num_samples > 0 else np.array([])

    if num_samples < MIN_REAL_SAMPLES or len(classes) < 2:
        print(
            f"[model-training-worker] Insufficient real interaction data (<{MIN_REAL_SAMPLES} usable rows or "
            f"single class: found {num_samples} rows, classes={classes.tolist()}). "
            f"Falling back to synthetic dataset generation."
        )
        X, y = synthesize_dataset(N_SAMPLES, SEED)
        training_mode = "synthetic"
        dataset_version = f"synthetic_v1_fallback_{num_samples}_real"
        split_ratio = 0.85
    else:
        pos_rate = float(np.mean(y))
        print(
            f"[model-training-worker] Training on {num_samples} real interaction logs "
            f"(positive rate: {pos_rate:.2%})."
        )
        training_mode = "real_interactions"
        dataset_version = f"real_interactions_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        split_ratio = 0.80

    # Temporal split (chronological order preserved)
    split_idx = int(len(X) * split_ratio)
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_NAMES)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=FEATURE_NAMES)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": 5,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "seed": SEED,
    }

    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=150,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=15,
        verbose_eval=25,
    )

    val_probs = booster.predict(dval)
    val_preds = (val_probs >= 0.5).astype(int)

    if len(np.unique(y_val)) >= 2:
        roc_auc = round(float(roc_auc_score(y_val, val_probs)), 4)
    else:
        roc_auc = 0.5

    metrics = {
        "roc_auc": roc_auc,
        "precision": round(float(precision_score(y_val, val_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_val, val_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_val, val_preds, zero_division=0)), 4),
        "train_samples": int(len(y_train)),
        "val_samples": int(len(y_val)),
        "positive_rate": round(float(np.mean(y)), 4),
        "training_mode": training_mode,
    }
    print(f"[model-training-worker] validation metrics: {metrics}")

    if os.path.dirname(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    booster.save_model(MODEL_PATH)
    print(f"[model-training-worker] saved model to {MODEL_PATH}")

    return MODEL_PATH, metrics, dataset_version, training_mode


def main():
    while True:
        version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        success = False
        try:
            path, metrics, dataset_version, training_mode = train()

            metadata = {
                "model_name": MODEL_NAME,
                "version": version,
                "training_date": datetime.now(timezone.utc).isoformat(),
                "dataset_version": dataset_version,
                "training_mode": training_mode,
                "feature_version": FEATURE_VERSION,
                "feature_names": FEATURE_NAMES,
                "metrics": metrics,
            }
            if os.path.dirname(MODEL_METADATA_PATH):
                os.makedirs(os.path.dirname(MODEL_METADATA_PATH), exist_ok=True)
            with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)
            print(f"[model-training-worker] saved metadata to {MODEL_METADATA_PATH}")

            publish("model.updated", {"version": version, "path": path, "metrics": metrics})
            success = True
        except Exception as e:
            import traceback
            print(f"[model-training-worker] training failed: {e}", file=sys.stderr)
            traceback.print_exc()

        daemon_mode = os.environ.get("DAEMON_MODE", "false").lower() == "true"
        if not daemon_mode:
            if not success:
                sys.exit(1)
            break

        print("[model-training-worker] sleeping for 24 hours...")
        time.sleep(86400)


if __name__ == "__main__":
    main()
