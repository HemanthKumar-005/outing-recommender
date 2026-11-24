"""
Model training worker: trains matrix factorization (ALS) and XGBoost on real interactions.
"""
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

import numpy as np
import xgboost as xgb
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score

sys.path.insert(0, "/shared")
try:
    from eventbus import publish
    from features import (
        FEATURE_NAMES,
        INTERACTION_WEIGHTS,
        POSITIVE_INTERACTION_TYPES,
        build_feature_vector,
    )
    from logging_config import configure_logging
    from pgdb import tenant_cursor
    from pgdb_platform import list_tenant_ids
except ImportError:
    from shared.eventbus import publish
    from shared.features import (
        FEATURE_NAMES,
        INTERACTION_WEIGHTS,
        POSITIVE_INTERACTION_TYPES,
        build_feature_vector,
    )
    from shared.logging_config import configure_logging
    from shared.pgdb import tenant_cursor
    from shared.pgdb_platform import list_tenant_ids

logger = configure_logging("model-training-worker")

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/xgboost_model.json")
MODEL_METADATA_PATH = os.environ.get("MODEL_METADATA_PATH", "/models/xgboost_model.meta.json")
MODEL_NAME = "xgboost_recommender"
FEATURE_VERSION = "v1"
DATASET_VERSION = "real_interactions_v1"
MIN_INTERACTIONS_TO_TRAIN = int(os.environ.get("MIN_INTERACTIONS_TO_TRAIN", "100"))
SEED = int(os.environ.get("TRAIN_SEED", "42"))


def maybe_enable_xgboost_flag(total_interactions: int) -> None:
    config_path = os.environ.get("RANKING_CONFIG_PATH", "/configs/ranking.yaml")
    if not os.path.exists(config_path):
        return
    try:
        import yaml
        with open(config_path) as f:
            cfg = yaml.safe_load(f) or {}
        min_interactions = cfg.get("feature_flags", {}).get("xgboost_min_interactions", 1000)
        if total_interactions >= min_interactions:
            cfg.setdefault("feature_flags", {})["xgboost_enabled"] = True
            with open(config_path, "w") as f:
                yaml.safe_dump(cfg, f, default_flow_style=False)
            logger.info(f"XGBoost feature flag automatically enabled ({total_interactions} >= {min_interactions})")
    except Exception as e:
        logger.warning(f"Could not update ranking config feature flag: {e}")


def load_real_data() -> tuple[list, dict, dict]:
    """Loads all interactions, places, and users across all tenants using RLS tenant_cursor."""
    all_interactions = []
    places_by_id = {}
    users_by_id = {}

    tenant_ids = []
    try:
        tenant_ids = list_tenant_ids()
    except Exception as e:
        logger.warning(f"Could not list tenant IDs from platform database: {e}")

    for tid in tenant_ids:
        try:
            with tenant_cursor(tid) as cur:
                cur.execute("SELECT user_id, place_id, type, rating, context, ts FROM interactions.interactions")
                rows = cur.fetchall()
                all_interactions.extend(rows)

                cur.execute("SELECT id, name, category, price_range, rating, review_count, lat, lng, sentiment_score, popularity_score, ambience, tags FROM places.places")
                for p in cur.fetchall():
                    places_by_id[p["id"]] = p

                cur.execute("SELECT id, budget_min, budget_max, preferred_categories, ambience_preferences FROM users.users")
                for u in cur.fetchall():
                    users_by_id[u["id"]] = u
        except Exception as e:
            logger.warning(f"Error fetching data for tenant {tid}: {e}")

    return all_interactions, places_by_id, users_by_id


def train_als_model(interactions: list) -> tuple[dict, dict]:
    """Trains an implicit ALS matrix factorization model on user-place interactions."""
    user_ids = sorted({it["user_id"] for it in interactions})
    place_ids = sorted({it["place_id"] for it in interactions})

    user_map = {uid: i for i, uid in enumerate(user_ids)}
    place_map = {pid: i for i, pid in enumerate(place_ids)}

    if not user_ids or not place_ids:
        return {}, {}

    try:
        from implicit.als import AlternatingLeastSquares
        from scipy.sparse import csr_matrix

        row_indices = []
        col_indices = []
        weights = []

        for it in interactions:
            u_idx = user_map.get(it["user_id"])
            p_idx = place_map.get(it["place_id"])
            w = INTERACTION_WEIGHTS.get(it.get("type"), 1)
            if u_idx is not None and p_idx is not None and w > 0:
                row_indices.append(u_idx)
                col_indices.append(p_idx)
                weights.append(float(w))

        if not row_indices:
            return {}, {}

        user_item_matrix = csr_matrix(
            (weights, (row_indices, col_indices)),
            shape=(len(user_ids), len(place_ids)),
        )

        als = AlternatingLeastSquares(factors=min(16, len(place_ids)), iterations=10, random_state=SEED)
        als.fit(user_item_matrix)

        user_factors = {uid: als.user_factors[user_map[uid]] for uid in user_ids}
        item_factors = {pid: als.item_factors[place_map[pid]] for pid in place_ids}
        return user_factors, item_factors
    except Exception as e:
        logger.warning(f"ALS collaborative filtering training failed or fallback: {e}")
        return {}, {}


def compute_als_cf_score(user_id: int, place_id: int, user_factors: dict, item_factors: dict) -> float:
    if user_id in user_factors and place_id in item_factors:
        u_f = user_factors[user_id]
        p_f = item_factors[place_id]
        dot = float(np.dot(u_f, p_f))
        # Sigmoid to normalize score to [0, 1]
        return float(1.0 / (1.0 + np.exp(-dot)))
    return 0.5


def train() -> tuple[str, dict] | None:
    all_interactions, places_by_id, users_by_id = load_real_data()
    total_interactions = len(all_interactions)
    logger.info(f"Loaded {total_interactions} real interactions from database")

    if total_interactions < MIN_INTERACTIONS_TO_TRAIN:
        logger.warning(
            f"Insufficient real interactions ({total_interactions} < {MIN_INTERACTIONS_TO_TRAIN}). "
            f"Skipping training until threshold is reached."
        )
        return None

    # Train ALS collaborative filtering model on real interactions
    user_factors, item_factors = train_als_model(all_interactions)

    # Build dataset
    X_rows = []
    y_labels = []

    for it in all_interactions:
        pid = it["place_id"]
        uid = it["user_id"]
        place = places_by_id.get(pid, {"id": pid, "price_range": 2})
        user = users_by_id.get(uid, {"id": uid, "budget_min": 0, "budget_max": 4})
        context = it.get("context") or {}

        cbf_score = 0.5
        cf_score = compute_als_cf_score(uid, pid, user_factors, item_factors)

        feat_vec = build_feature_vector(place, context, user, cbf_score, cf_score)
        X_rows.append(feat_vec)

        # Positive label if save/visit/rating/share or rating >= 3.5
        is_pos = (
            it.get("type") in POSITIVE_INTERACTION_TYPES
            or (it.get("rating") is not None and it["rating"] >= 3.5)
        )
        y_labels.append(1 if is_pos else 0)

    X = np.array(X_rows, dtype=float)
    y = np.array(y_labels, dtype=int)

    # Train/val split
    n = len(X)
    split = int(n * 0.8)
    indices = np.arange(n)
    np.random.default_rng(SEED).shuffle(indices)

    X_train, X_val = X[indices[:split]], X[indices[split:]]
    y_train, y_val = y[indices[:split]], y[indices[split:]]

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
        params, dtrain, num_boost_round=100,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=10, verbose_eval=False,
    )

    val_probs = booster.predict(dval)
    val_preds = (val_probs >= 0.5).astype(int)

    metrics = {
        "roc_auc": round(float(roc_auc_score(y_val, val_probs)), 4) if len(set(y_val)) > 1 else 0.5,
        "precision": round(float(precision_score(y_val, val_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_val, val_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_val, val_preds, zero_division=0)), 4),
        "total_interactions": total_interactions,
        "val_samples": int(len(y_val)),
    }
    logger.info(f"Validation metrics on real interaction data: {metrics}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    booster.save_model(MODEL_PATH)
    logger.info(f"Saved model to {MODEL_PATH}")

    # Check and optionally enable XGBoost feature flag if min interactions satisfied
    maybe_enable_xgboost_flag(total_interactions)

    return MODEL_PATH, metrics


def main():
    version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    result = train()
    if result is None:
        return

    path, metrics = result
    metadata = {
        "model_name": MODEL_NAME,
        "version": version,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_version": DATASET_VERSION,
        "feature_version": FEATURE_VERSION,
        "feature_names": FEATURE_NAMES,
        "metrics": metrics,
    }
    with open(MODEL_METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved metadata to {MODEL_METADATA_PATH}")

    publish("model.updated", {"version": version, "path": path, "metrics": metrics})
    logger.info("Published model.updated event")


if __name__ == "__main__":
    main()
