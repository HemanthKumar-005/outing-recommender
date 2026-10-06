"""
Toy model trainer.

In a real deployment this would pull labeled data from the interactions +
places + users tables (e.g. "did the user visit/save what was recommended")
and engineer features via shared/features.py. For a runnable demo we
synthesize a plausible dataset with the same feature schema, train an
XGBoost binary classifier ("would the user engage with this place?"),
save it to the shared /models volume, and publish a model.updated event
so recommendation-engine hot-reloads it.

Run manually:  docker compose run --rm model-training-worker
Or on a schedule by adding a cron/loop around main().
"""
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

import numpy as np
import xgboost as xgb
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score

sys.path.insert(0, "/shared")
from eventbus import publish  # noqa: E402
from features import FEATURE_NAMES  # noqa: E402

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/xgboost_model.json")
MODEL_METADATA_PATH = os.environ.get("MODEL_METADATA_PATH", "/models/xgboost_model.meta.json")
MODEL_NAME = "xgboost_recommender"
FEATURE_VERSION = "v1"  # bump whenever FEATURE_NAMES / build_feature_vector changes
DATASET_VERSION = "synthetic_v1"  # Review §35 Option A: synthetic until real interaction volume exists
N_SAMPLES = int(os.environ.get("N_TRAIN_SAMPLES", "20000"))
SEED = int(os.environ.get("TRAIN_SEED", "42"))


def synthesize_dataset(n: int, seed: int):
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

    # A hand-crafted "true" utility function to generate plausible labels:
    # closer, on-budget, well-matched (cbf/cf), well-reviewed, popular places
    # win, with a rain penalty for outdoor-leaning evening plans.
    logit = (
        -0.15 * distance_km
        + 1.1 * price_fit
        + 1.8 * cbf_score
        + 1.3 * cf_score
        + 1.0 * sentiment_score
        + 0.6 * popularity_score
        + 0.2 * is_weekend
        - 0.4 * is_rainy * is_evening_or_night
        + rng.normal(0, 0.5, n)  # noise
    )
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.uniform(0, 1, n) < prob).astype(int)
    return X, y


def train() -> tuple:
    random.seed(SEED)
    X, y = synthesize_dataset(N_SAMPLES, SEED)

    split = int(N_SAMPLES * 0.85)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

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
        params, dtrain, num_boost_round=150,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=15, verbose_eval=25,
    )

    val_probs = booster.predict(dval)
    val_preds = (val_probs >= 0.5).astype(int)
    metrics = {
        "roc_auc": round(float(roc_auc_score(y_val, val_probs)), 4),
        "precision": round(float(precision_score(y_val, val_preds)), 4),
        "recall": round(float(recall_score(y_val, val_preds)), 4),
        "f1": round(float(f1_score(y_val, val_preds)), 4),
        "val_samples": int(len(y_val)),
    }
    print(f"[model-training-worker] validation metrics: {metrics}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    booster.save_model(MODEL_PATH)
    print(f"[model-training-worker] saved model to {MODEL_PATH}")
    return MODEL_PATH, metrics


def main():
    while True:
        version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        try:
            path, metrics = train()
            
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
            print(f"[model-training-worker] saved metadata to {MODEL_METADATA_PATH}")

            publish("model.updated", {"version": version, "path": path, "metrics": metrics})
        except Exception as e:
            print(f"[model-training-worker] training failed: {e}")
            
        daemon_mode = os.environ.get("DAEMON_MODE", "false").lower() == "true"
        if not daemon_mode:
            break
            
        print("[model-training-worker] sleeping for 24 hours...")
        time.sleep(86400)


if __name__ == "__main__":
    main()
