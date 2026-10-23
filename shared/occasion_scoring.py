"""
Occasion relevance score for a single place candidate.

Pure function — no I/O. Used by recommendation-engine fusion and by
itinerary-service when ranking backup candidates.
"""
from __future__ import annotations

from typing import Any, Iterable

from config_loader import occasion_by_id, scoring_knobs


def _as_set(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, str):
        return {value}
    try:
        return {str(x) for x in value}
    except TypeError:
        return set()


def occasion_score(
    place: dict[str, Any],
    occasion_id: str | None,
    *,
    knobs: dict[str, float] | None = None,
) -> tuple[float, list[str]]:
    """
    Returns (score in [0, 1], human-readable reason fragments).

    place keys used (all optional): category, tags, ambience, couple_friendly
    """
    if not occasion_id:
        return 0.0, []

    meta = occasion_by_id(occasion_id)
    if not meta:
        return 0.0, []

    k = knobs or scoring_knobs()
    score = 0.0
    reasons: list[str] = []

    tags = _as_set(place.get("tags"))
    preferred_tags = _as_set(meta.get("preferred_tags"))
    overlap = tags & preferred_tags
    if overlap:
        boost = min(
            float(k.get("tag_match_cap", 0.5)),
            len(overlap) * float(k.get("tag_match_boost", 0.25)),
        )
        score += boost
        reasons.append(f"Matches {occasion_id.replace('_', ' ')} tags")

    category = (place.get("category") or "").lower()
    preferred_cats = {c.lower() for c in meta.get("preferred_categories") or []}
    if category and category in preferred_cats:
        score += float(k.get("category_match_boost", 0.2))
        reasons.append(f"Good category for {meta.get('label', occasion_id)}")

    demote_cats = {c.lower() for c in meta.get("demote_categories") or []}
    if category and category in demote_cats:
        score = max(0.0, score - float(k.get("demote_penalty", 0.18)))

    ambience = _as_set(place.get("ambience"))
    preferred_amb = _as_set(meta.get("preferred_ambience"))
    if ambience & preferred_amb:
        score += float(k.get("ambience_match_boost", 0.1))
        reasons.append("Ambience fits the occasion")

    if meta.get("boost_couple_friendly") and place.get("couple_friendly"):
        score += float(k.get("couple_friendly_boost", 0.15))
        reasons.append("Couple-friendly venue")

    return min(1.0, score), reasons


def rank_by_occasion(
    places: Iterable[dict[str, Any]],
    occasion_id: str | None,
) -> list[tuple[dict[str, Any], float, list[str]]]:
    """Sort places by occasion score descending; stable for ties."""
    scored = []
    for p in places:
        s, reasons = occasion_score(p, occasion_id)
        scored.append((p, s, reasons))
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored
