"""
Comprehensive test suite verifying:
1. Opening hours evaluation across multiple shifts, midnight-crossing, closed days, and missing hours.
2. Ranking scoring: time_suitability, budget_suitability, context_score.
3. Explanations generator: reasons with open hours and cost for two.
4. Place catalog integrity: all 310 places have required schema fields.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
ENGINE_APP_DIR = ROOT / "services" / "recommendation-engine" / "app"

for p in (str(SHARED_DIR), str(ENGINE_APP_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

try:
    from shared.hours_pricing import (  # type: ignore # noqa: E402
        KOLKATA_TZ,
        WEEKDAYS,
        compute_price_tier,
        evaluate_place_hours,
        format_12hr,
        format_price_display,
        parse_osm_opening_hours,
    )
except ImportError:
    from hours_pricing import (  # type: ignore # noqa: E402
        KOLKATA_TZ,
        WEEKDAYS,
<<<<<<< HEAD
        evaluate_place_hours,
=======
        compute_price_tier,
        evaluate_place_hours,
        format_12hr,
        format_price_display,
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        parse_osm_opening_hours,
    )

try:
    from scoring import (  # type: ignore # noqa: E402
        budget_suitability,
        build_explanation,
        context_score,
        time_suitability,
    )
except ImportError:
    from app.scoring import (  # type: ignore # noqa: E402
        budget_suitability,
        build_explanation,
        context_score,
        time_suitability,
    )


def test_osm_parser():
    # 24/7
    res = parse_osm_opening_hours("24/7")
    assert res is not None and res["mon"] == [["00:00", "24:00"]]

    # Multiple rules
    res = parse_osm_opening_hours("Mo-Fr 09:00-20:00; Sa-Su 10:00-22:00")
    assert res is not None
    assert res["mon"] == [["09:00", "20:00"]]
    assert res["sat"] == [["10:00", "22:00"]]

    # Off day
    res = parse_osm_opening_hours("Tu-Su 10:00-18:00; Mo off")
    assert res is not None
    assert res["mon"] == []
    assert res["tue"] == [["10:00", "18:00"]]


def test_hours_evaluation():
    # 1. Missing hours -> Never 'closed', returns 'hours unavailable'
    res = evaluate_place_hours({})
    assert res["open_now"] is None
    assert res["hours_status"] == "Hours unavailable"
    assert res["hours_detail"] == "Hours unavailable"

    # 2. Split shift restaurant: 11:30-15:30 and 19:00-23:30
    hours = {d: [["11:30", "15:30"], ["19:00", "23:30"]] for d in WEEKDAYS}

    # At 13:00 Monday -> Open now, Open until 3:30 PM
    dt_lunch = datetime(2026, 10, 12, 13, 0, tzinfo=KOLKATA_TZ)  # Monday
    res = evaluate_place_hours(hours, dt_lunch)
    assert res["open_now"] is True
    assert "Open until 3:30 PM" in res["hours_detail"]

    # At 15:10 Monday -> Closes in 20 min
    dt_closing = datetime(2026, 10, 12, 15, 10, tzinfo=KOLKATA_TZ)
    res = evaluate_place_hours(hours, dt_closing)
    assert res["open_now"] is True
    assert "Closes in 20 min" in res["hours_detail"]

    # At 16:30 Monday -> Closed, opens today at 7 PM
    dt_between = datetime(2026, 10, 12, 16, 30, tzinfo=KOLKATA_TZ)
    res = evaluate_place_hours(hours, dt_between)
    assert res["open_now"] is False
    assert "Opens today at 7 PM" in res["hours_detail"]

    # 3. Overnight bar: 18:00 - 01:30
    bar_hours = {d: [["18:00", "01:30"]] for d in WEEKDAYS}
    # Friday 23:00 -> Open now, closes at 1:30 AM
    dt_bar_late = datetime(2026, 10, 16, 23, 0, tzinfo=KOLKATA_TZ)  # Friday
    res = evaluate_place_hours(bar_hours, dt_bar_late)
    assert res["open_now"] is True
    assert "Open until 1:30 AM" in res["hours_detail"]

    # Saturday 00:50 AM -> Open from Friday overnight, closes in 40 min
    dt_bar_next_am = datetime(2026, 10, 17, 0, 50, tzinfo=KOLKATA_TZ)  # Saturday morning
    res = evaluate_place_hours(bar_hours, dt_bar_next_am)
    assert res["open_now"] is True
    assert "Closes in 40 min" in res["hours_detail"]


def test_ranking_and_explanations():
    place_open = {
        "name": "Test Cafe",
        "category": "cafe",
        "opening_hours": {d: [["09:00", "23:00"]] for d in WEEKDAYS},
        "cost_for_two": 600.0,
        "price_range": 2,
        "entry_fee": 0.0,
        "open_now": True,
        "hours_detail": "Open until 11 PM",
        "pricing_is_estimated": True,
    }

    context = {"datetime": "2026-10-12T14:00:00", "weather": {"condition": "clear"}}
    user = {"budget_min": 1, "budget_max": 3}

    # time_suitability when open
    s_time = time_suitability(place_open, context)
    assert s_time == 1.0

    # budget suitability
    s_budget = budget_suitability(place_open, user, budget_override="budget")
    assert s_budget >= 0.9

    # context score
    c_score, components = context_score(place_open, context, user, "friends", budget_override="medium")
    assert c_score > 0.7
    assert "time" in components and "budget" in components

    # build_explanation reasons
    breakdown = {"context_components": components, "cbf_score": 0.6, "cf_score": 0.2}
    reasons = build_explanation(place_open, breakdown, distance_km=2.1)
    assert any("Open until 11 PM" in r for r in reasons)
    assert any("600 for two" in r for r in reasons)


def test_catalog_integrity():
    cat_path = ROOT / "data" / "places_catalog.yaml"
    with open(cat_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    places = data.get("places") or []
<<<<<<< HEAD
    assert len(places) >= 300, f"Expected at least 300 curated places, found {len(places)}"

    # Truthfulness gates (see scripts/quarantine_catalog.py):
    import re as _re
    for p in places:
        assert p.get("source") == "repo_curated", f"{p['name']}: missing provenance"
        assert p.get("verification_status") in ("unverified", "verified"), p["name"]
        assert not _re.search(r" Spot \d+$", p["name"]), f"generated placeholder leaked into catalog: {p['name']}"
    taj = next(p for p in places if p["name"] == "Taj Mahal")
    assert taj["opening_hours"]["fri"] == [], "Taj Mahal is closed on Fridays"
    assert taj["opening_hours"]["mon"], "Taj Mahal is open on Mondays"
=======
    assert len(places) >= 310, f"Expected at least 310 places, found {len(places)}"
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

    for p in places:
        assert "opening_hours" in p, f"Missing opening_hours in {p['name']}"
        assert isinstance(p["opening_hours"], dict)
        assert all(d in p["opening_hours"] for d in WEEKDAYS)
        assert "opening_hours_source" in p
        assert "opening_hours_is_estimated" in p
        assert "cost_for_two" in p
        assert p["cost_for_two"] >= 0
        assert "pricing_source" in p
        assert "pricing_is_estimated" in p
        assert "entry_fee" in p
        assert 0 <= p["price_range"] <= 4
