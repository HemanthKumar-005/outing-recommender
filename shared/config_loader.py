"""
Central config loader for ranking, occasions, tips, and timeline templates.

All feature knobs live in configs/*.yaml — services never hard-code occasion
lists, tip text, or timeline steps. Results are cached in-process after first
load so repeated scoring stays O(1) on the config side.
"""
from __future__ import annotations

import functools
import os
from pathlib import Path
from typing import Any

import yaml

# Docker images COPY configs to /configs; local dev can override via env.
_CONFIG_ROOT = Path(os.environ.get("CONFIG_ROOT", "/configs"))
_LOCAL_FALLBACK = Path(__file__).resolve().parents[1] / "configs"
_DATA_ROOT = Path(os.environ.get("DATA_ROOT", "/data"))
_LOCAL_DATA_FALLBACK = Path(__file__).resolve().parents[1] / "data"


def _resolve(name: str, root: Path, fallback: Path) -> Path:
    primary = root / name
    if primary.is_file():
        return primary
    alt = fallback / name
    if alt.is_file():
        return alt
    raise FileNotFoundError(f"Config not found: {name} (tried {primary} and {alt})")


def _load_yaml(name: str, *, data: bool = False) -> dict[str, Any]:
    root = _DATA_ROOT if data else _CONFIG_ROOT
    fallback = _LOCAL_DATA_FALLBACK if data else _LOCAL_FALLBACK
    path = _resolve(name, root, fallback)
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@functools.lru_cache(maxsize=8)
def ranking_config() -> dict[str, Any]:
    return _load_yaml("ranking.yaml")


@functools.lru_cache(maxsize=8)
def occasions_config() -> dict[str, Any]:
    return _load_yaml("occasions.yaml")


@functools.lru_cache(maxsize=8)
def tips_config() -> dict[str, Any]:
    return _load_yaml("occasion_tips.yaml")


@functools.lru_cache(maxsize=8)
def timeline_config() -> dict[str, Any]:
    return _load_yaml("timeline_templates.yaml")


@functools.lru_cache(maxsize=4)
def india_locations() -> dict[str, Any]:
    """States/cities for the location picker (not recommendation hard-coding)."""
    return _load_yaml("india_locations.yaml")


@functools.lru_cache(maxsize=4)
def places_catalog() -> dict[str, Any]:
    return _load_yaml("places_catalog.yaml", data=True)


def occasion_by_id(occasion_id: str | None) -> dict[str, Any] | None:
    if not occasion_id:
        return None
    for item in occasions_config().get("occasions", []):
        if item.get("id") == occasion_id:
            return item
    return None


def scoring_knobs() -> dict[str, float]:
    return dict(occasions_config().get("scoring", {}))


def budget_band(band_id: str) -> dict[str, Any]:
    bands = occasions_config().get("budget_bands", {})
    return bands.get(band_id) or bands.get("medium") or {}


def duration_meta(duration_id: str) -> dict[str, Any]:
    for d in occasions_config().get("durations", []):
        if d.get("id") == duration_id:
            return d
    return {"id": duration_id, "label": duration_id, "default_stops": 3}


def tips_for(occasion_id: str | None) -> list[str]:
    cfg = tips_config()
    tips = cfg.get("tips", {})
    if occasion_id and occasion_id in tips:
        return list(tips[occasion_id])
    return list(cfg.get("default_tips", []))


def brewery_safety_note() -> str:
    return tips_config().get("brewery_safety_note", "")


def timeline_for(duration: str, occasion: str | None) -> list[dict[str, Any]]:
    templates = timeline_config().get("templates", {})
    by_duration = templates.get(duration) or templates.get("4-6 hours") or {}
    steps = by_duration.get(occasion) or by_duration.get("default") or []
    return list(steps)


def constraints_for(occasion: str | None) -> dict[str, Any]:
    all_c = timeline_config().get("constraints", {})
    return dict(all_c.get(occasion) or all_c.get("default") or {})


def title_for(occasion: str | None, area: str) -> str:
    titles = timeline_config().get("title_templates", {})
    tmpl = titles.get(occasion) or titles.get("default") or "Outing plan for {area}"
    return tmpl.format(area=area or "your area")


def description_for(occasion: str | None, duration: str) -> str:
    descs = timeline_config().get("description_templates", {})
    tmpl = descs.get(occasion) or descs.get("default") or "A {duration} plan."
    return tmpl.format(duration=duration or "outing")


def list_occasion_ids() -> list[str]:
    return [o["id"] for o in occasions_config().get("occasions", []) if "id" in o]


def list_occasions_public() -> list[dict[str, str]]:
    """Safe subset for frontend / API discovery (no scoring internals)."""
    return [
        {
            "id": o["id"],
            "label": o.get("label", o["id"]),
            "description": o.get("description", ""),
        }
        for o in occasions_config().get("occasions", [])
        if "id" in o
    ]


def list_states() -> list[str]:
    return [s["name"] for s in india_locations().get("states", []) if s.get("name")]


def list_cities(state: str | None = None) -> list[dict[str, Any]]:
    """Flat list of {state, name, lat, lng} optionally filtered by state."""
    out: list[dict[str, Any]] = []
    for s in india_locations().get("states", []):
        if state and s.get("name") != state:
            continue
        for c in s.get("cities") or []:
            out.append({
                "state": s.get("name"),
                "name": c.get("name"),
                "lat": c.get("lat"),
                "lng": c.get("lng"),
            })
    return out


def resolve_city(city_name: str, state: str | None = None) -> dict[str, Any] | None:
    """Look up coordinates for a city name (case-insensitive)."""
    needle = (city_name or "").strip().lower()
    if not needle:
        return None
    for c in list_cities(state):
        if (c.get("name") or "").lower() == needle:
            return c
    # partial match
    for c in list_cities(state):
        if needle in (c.get("name") or "").lower():
            return c
    return None


def default_search_radius_km() -> float:
    return float(india_locations().get("default_radius_km") or 25)
