from __future__ import annotations

import os
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
ENGINE_APP_DIR = ROOT / "services" / "recommendation-engine" / "app"

for p in (str(SHARED_DIR), str(ENGINE_APP_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

import scoring
from fusion import fuse_candidate, profile_weights


def test_weather_suitability_heatwave():
    outdoor_place = {"id": 1, "indoor_outdoor": "outdoor"}
    indoor_place = {"id": 2, "indoor_outdoor": "indoor"}

    # Extreme heatwave (42°C)
    heat_ctx = {"weather": {"temp_c": 42.0, "condition": "clear"}, "time_of_day": "afternoon"}
    assert scoring.weather_suitability(outdoor_place, heat_ctx) == 0.15
    assert scoring.weather_suitability(indoor_place, heat_ctx) == 0.95


def test_weather_suitability_cold_and_rain():
    outdoor_place = {"id": 1, "indoor_outdoor": "outdoor"}
    indoor_place = {"id": 2, "indoor_outdoor": "indoor"}

    # Freezing cold (4°C)
    cold_ctx = {"weather": {"temp_c": 4.0, "condition": "clear"}}
    assert scoring.weather_suitability(outdoor_place, cold_ctx) == 0.25
    assert scoring.weather_suitability(indoor_place, cold_ctx) == 0.95

    # Rain
    rain_ctx = {"weather": {"temp_c": 22.0, "condition": "rain"}}
    assert scoring.weather_suitability(outdoor_place, rain_ctx) == 0.15
    assert scoring.weather_suitability(indoor_place, rain_ctx) == 0.95


def test_weather_suitability_golden_hour():
    rooftop_place = {"id": 1, "indoor_outdoor": "outdoor", "tags": ["rooftop", "cocktails"]}
    evening_ctx = {"weather": {"temp_c": 24.0, "condition": "clear"}, "time_of_day": "evening"}
    assert scoring.weather_suitability(rooftop_place, evening_ctx) == 1.0


def test_collaborative_filtering_scores():
    # User 1 likes place 10 and 20
    # User 2 likes place 10 and 30
    # Candidate places: 10, 20, 30, 40
    all_interactions = [
        {"user_id": 1, "place_id": 10, "type": "save"},
        {"user_id": 1, "place_id": 20, "type": "visit"},
        {"user_id": 2, "place_id": 10, "type": "save"},
        {"user_id": 2, "place_id": 30, "type": "rating"},
        {"user_id": 3, "place_id": 40, "type": "rating"},
    ]
    candidate_places = [{"id": 10}, {"id": 20}, {"id": 30}, {"id": 40}]
    cf_map, n_pos = scoring.cf_scores(1, candidate_places, all_interactions)

    assert n_pos == 2  # user 1 liked place 10 and 20
    # Place 30 was liked by User 2, who also likes place 10 (co-occurrence with User 1)
    assert cf_map[30] > 0.0
    # Place 40 had no co-occurrence with User 1
    assert cf_map[40] == 0.0


def test_fuse_candidate_weight_overrides():
    place = {"id": 1, "name": "Cozy Cafe", "category": "cafe"}
    components = {
        "content": 0.5,
        "collaborative": 0.5,
        "ml": 0.5,
        "context": 0.5,
        "distance": 1.0,
        "popularity": 0.2,
        "sentiment": 0.5,
    }
    # Standard fusion
    score_normal, _, _ = fuse_candidate(place, components, occasion=None, n_positive_interactions=0)

    # Override distance to 1.0 and popularity to 0.0
    overrides = {"distance": 1.0, "popularity": 0.0}
    score_overridden, _, breakdown = fuse_candidate(
        place, components, occasion=None, n_positive_interactions=0, weight_overrides=overrides
    )
    assert score_overridden >= score_normal
    assert "distance" in breakdown


def test_group_consensus_aggregation():
    # Two users, three places
    scores_per_user = {
        1: {101: 0.9, 102: 0.6, 103: 0.3},
        2: {101: 0.8, 102: 0.7, 103: 0.9},
    }
    # Least misery: min per place
    lm = scoring.aggregate_group_scores(scores_per_user, method="least_misery")
    assert lm[101] == 0.8
    assert lm[102] == 0.6
    assert lm[103] == 0.3
    # Place 101 has highest min satisfaction
    assert max(lm, key=lm.get) == 101

    # Average
    avg = scoring.aggregate_group_scores(scores_per_user, method="average")
    assert avg[101] == pytest.approx(0.85)
    assert avg[102] == pytest.approx(0.65)
    assert avg[103] == pytest.approx(0.60)
