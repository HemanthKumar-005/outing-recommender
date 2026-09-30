"""
Offline evaluation + ablation study (Review §37-39).

There is no real logged-interaction dataset yet (Review §35 Option A), so
this harness evaluates against the same synthetic ground-truth generator
used to train the toy XGBoost model (services/model-training-worker/train.py):
a hand-crafted latent-utility function stands in for "would the user engage
with this place?". This is honestly a synthetic-data evaluation, not a
claim about real-world accuracy - swap `synthesize_session` for a loader
over real interaction logs once enough volume exists, everything downstream
(metrics, ablation loop) stays the same.

Metrics: Precision@K, Recall@K, NDCG@K, MAP@K, averaged over many synthetic
"sessions" (a user + a pool of candidate places at one point in time).

Ablation: re-rank each session with one scoring component zeroed out at a
time (content, collaborative, ml, context, distance, sentiment, popularity)
to see how much each contributes to ranking quality - directly answers
"which components actually matter" for the Review's required ablation study.

Usage:
    pip install numpy xgboost scikit-learn
    python3 scripts/evaluate.py
"""
import math
import random
import sys

import numpy as np
import xgboost as xgb

sys.path.insert(0, "shared")
from features import FEATURE_NAMES  # noqa: E402

RELEVANCE_THRESHOLD = 0.5  # y == 1 candidates are "relevant" for this session
K = 5
N_SESSIONS = 300
CANDIDATES_PER_SESSION = 20
SEED = 7

COMPONENT_INDEX = {
    "distance": 0, "price_fit": 1, "content": 2, "collaborative": 3,
    "sentiment": 4, "popularity": 5,
}
FULL_WEIGHTS = {
    "ml": 0.35, "content": 0.20, "collaborative": 0.15,
    "distance": 0.10, "sentiment": 0.10, "popularity": 0.10,
}


def synthesize_session(rng: np.random.Generator, n: int):
    """Mirrors model-training-worker/train.py's synthesize_dataset, at
    per-session scale, with the same latent utility function."""
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
        -0.15 * distance_km + 1.1 * price_fit + 1.8 * cbf_score + 1.3 * cf_score
        + 1.0 * sentiment_score + 0.6 * popularity_score + 0.2 * is_weekend
        - 0.4 * is_rainy * is_evening_or_night + rng.normal(0, 0.5, n)
    )
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.uniform(0, 1, n) < prob).astype(int)
    return X, y, prob  # prob doubles as a soft "true" relevance for NDCG gains


def train_scoring_model(rng: np.random.Generator):
    X, y, _ = synthesize_session(rng, 8000)
    dtrain = xgb.DMatrix(X, label=y, feature_names=FEATURE_NAMES)
    params = {"objective": "binary:logistic", "eval_metric": "auc", "max_depth": 5, "eta": 0.1, "seed": SEED}
    return xgb.train(params, dtrain, num_boost_round=100, verbose_eval=False)


def fuse(X_row, xgb_score: float, weights: dict) -> float:
    distance_score = max(0.0, 1.0 - min(X_row[COMPONENT_INDEX["distance"]], 20.0) / 20.0)
    return (
        weights.get("ml", 0) * xgb_score
        + weights.get("content", 0) * X_row[COMPONENT_INDEX["content"]]
        + weights.get("collaborative", 0) * X_row[COMPONENT_INDEX["collaborative"]]
        + weights.get("distance", 0) * distance_score
        + weights.get("sentiment", 0) * X_row[COMPONENT_INDEX["sentiment"]]
        + weights.get("popularity", 0) * X_row[COMPONENT_INDEX["popularity"]]
    )


def precision_at_k(ranked_relevance, k):
    top = ranked_relevance[:k]
    return sum(top) / k


def recall_at_k(ranked_relevance, k, total_relevant):
    if total_relevant == 0:
        return None
    top = ranked_relevance[:k]
    return sum(top) / total_relevant


def ndcg_at_k(ranked_gains, k):
    dcg = sum(g / math.log2(i + 2) for i, g in enumerate(ranked_gains[:k]))
    ideal = sorted(ranked_gains, reverse=True)
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal[:k]))
    return dcg / idcg if idcg > 0 else 0.0


def average_precision(ranked_relevance):
    hits, total = 0, 0.0
    for i, rel in enumerate(ranked_relevance):
        if rel:
            hits += 1
            total += hits / (i + 1)
    n_relevant = sum(ranked_relevance)
    return total / n_relevant if n_relevant else 0.0


def main():
    rng = np.random.default_rng(SEED)
    random.seed(SEED)

    print(f"Training scoring model on synthetic data (seed={SEED})...")
    model = train_scoring_model(rng)

    print(f"Generating {N_SESSIONS} synthetic evaluation sessions "
          f"({CANDIDATES_PER_SESSION} candidates each)...")
    sessions = [synthesize_session(rng, CANDIDATES_PER_SESSION) for _ in range(N_SESSIONS)]

    def xgb_scores_for(X):
        dmat = xgb.DMatrix(X, feature_names=FEATURE_NAMES)
        return model.predict(dmat)

    # Precompute xgb scores per session to avoid re-predicting per-row in the loop.
    session_xgb_scores = [xgb_scores_for(X) for X, _, _ in sessions]

    results = {}

    # --- Full hybrid ---
    def eval_with_weights(weights, use_ml=True):
        precisions, recalls, ndcgs, maps = [], [], [], []
        for s_idx, (X, y, prob) in enumerate(sessions):
            xs = session_xgb_scores[s_idx]
            scores = [
                fuse(X[i], xs[i] if use_ml else 0.5, weights)
                for i in range(len(X))
            ]
            order = np.argsort(scores)[::-1]
            ranked_relevance = [int(y[i]) for i in order]
            ranked_gains = [float(prob[i]) for i in order]
            precisions.append(precision_at_k(ranked_relevance, K))
            r = recall_at_k(ranked_relevance, K, sum(y))
            if r is not None:
                recalls.append(r)
            ndcgs.append(ndcg_at_k(ranked_gains, K))
            maps.append(average_precision(ranked_relevance))
        return {
            "precision@k": round(float(np.mean(precisions)), 4),
            "recall@k": round(float(np.mean(recalls)), 4) if recalls else None,
            "ndcg@k": round(float(np.mean(ndcgs)), 4),
            "map": round(float(np.mean(maps)), 4),
        }

    results["hybrid (full)"] = eval_with_weights(FULL_WEIGHTS)

    # --- Ablation: drop one component at a time, renormalizing the rest ---
    for component in FULL_WEIGHTS:
        ablated = {k: v for k, v in FULL_WEIGHTS.items() if k != component}
        total = sum(ablated.values())
        ablated = {k: v / total for k, v in ablated.items()}
        results[f"ablate: -{component}"] = eval_with_weights(ablated, use_ml=(component != "ml"))

    # --- Baselines ---
    def popularity_only(session_idx):
        X, y, prob = sessions[session_idx]
        return X[:, COMPONENT_INDEX["popularity"]]

    precisions, recalls, ndcgs, maps = [], [], [], []
    for s_idx, (X, y, prob) in enumerate(sessions):
        scores = X[:, COMPONENT_INDEX["popularity"]]
        order = np.argsort(scores)[::-1]
        ranked_relevance = [int(y[i]) for i in order]
        ranked_gains = [float(prob[i]) for i in order]
        precisions.append(precision_at_k(ranked_relevance, K))
        r = recall_at_k(ranked_relevance, K, sum(y))
        if r is not None:
            recalls.append(r)
        ndcgs.append(ndcg_at_k(ranked_gains, K))
        maps.append(average_precision(ranked_relevance))
    results["baseline: popularity-only"] = {
        "precision@k": round(float(np.mean(precisions)), 4),
        "recall@k": round(float(np.mean(recalls)), 4) if recalls else None,
        "ndcg@k": round(float(np.mean(ndcgs)), 4),
        "map": round(float(np.mean(maps)), 4),
    }

    precisions, recalls, ndcgs, maps = [], [], [], []
    for X, y, prob in sessions:
        order = list(range(len(X)))
        random.shuffle(order)
        ranked_relevance = [int(y[i]) for i in order]
        ranked_gains = [float(prob[i]) for i in order]
        precisions.append(precision_at_k(ranked_relevance, K))
        r = recall_at_k(ranked_relevance, K, sum(y))
        if r is not None:
            recalls.append(r)
        ndcgs.append(ndcg_at_k(ranked_gains, K))
        maps.append(average_precision(ranked_relevance))
    results["baseline: random"] = {
        "precision@k": round(float(np.mean(precisions)), 4),
        "recall@k": round(float(np.mean(recalls)), 4) if recalls else None,
        "ndcg@k": round(float(np.mean(ndcgs)), 4),
        "map": round(float(np.mean(maps)), 4),
    }

    print(f"\n=== Results (K={K}, {N_SESSIONS} sessions, synthetic ground truth) ===")
    header = f"{'strategy':<28}{'P@K':>8}{'R@K':>8}{'NDCG@K':>10}{'MAP':>8}"
    print(header)
    print("-" * len(header))
    for name, m in results.items():
        print(f"{name:<28}{m['precision@k']:>8}{m['recall@k'] or 0:>8}{m['ndcg@k']:>10}{m['map']:>8}")

    with open("evaluation_results.csv", "w") as f:
        f.write("strategy,precision@k,recall@k,ndcg@k,map\n")
        for name, m in results.items():
            f.write(f"{name},{m['precision@k']},{m['recall@k']},{m['ndcg@k']},{m['map']}\n")
    print("\nSaved evaluation_results.csv")

    # Also write into evaluation/ so it's picked up by the recommendation-engine's
    # /model-card endpoint (mounted read-only at /evaluation in docker-compose).
    import os
    os.makedirs("evaluation", exist_ok=True)
    with open("evaluation/evaluation_results.csv", "w") as f:
        f.write("strategy,precision@k,recall@k,ndcg@k,map\n")
        for name, m in results.items():
            f.write(f"{name},{m['precision@k']},{m['recall@k']},{m['ndcg@k']},{m['map']}\n")
    print("Saved evaluation/evaluation_results.csv (used by the recommendation-engine's /model-card endpoint)")


if __name__ == "__main__":
    main()
