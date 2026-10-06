"""
Fuse component scores using profiles from configs/ranking.yaml.
Occasion score is computed via shared.occasion_scoring (config-driven).
"""
from __future__ import annotations

import sys
from typing import Any

sys.path.insert(0, "/shared")
from config_loader import ranking_config  # noqa: E402
from occasion_scoring import occasion_score  # noqa: E402


def profile_weights(n_positive_interactions: int) -> dict[str, float]:
    cfg = ranking_config()
    threshold = int(cfg.get("cold_start", {}).get("min_interactions_for_cf", 3))
    profiles = cfg.get("profiles", {})
    key = "existing_user" if n_positive_interactions >= threshold else "new_user"
    return dict(profiles.get(key) or profiles.get("new_user") or {})


def fuse_candidate(
    place: dict[str, Any],
    components: dict[str, float],
    *,
    occasion: str | None,
    n_positive_interactions: int = 0,
) -> tuple[float, list[str], dict[str, float]]:
    """
    components: precomputed content, collaborative, ml, context, distance,
                popularity, sentiment scores in [0,1].
    Returns (final_score, reasons, breakdown).
    """
    weights = profile_weights(n_positive_interactions)
    occ_s, occ_reasons = occasion_score(place, occasion)
    breakdown = {**components, "occasion": occ_s}

    total_w = 0.0
    fused = 0.0
    for name, w in weights.items():
        if w <= 0:
            continue
        fused += w * float(breakdown.get(name, 0.0))
        total_w += w
    if total_w > 0:
        fused /= total_w

    reasons = list(occ_reasons)
    return fused, reasons, breakdown
