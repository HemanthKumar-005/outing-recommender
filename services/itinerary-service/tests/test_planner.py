from __future__ import annotations

import os
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
ITINERARY_APP_DIR = ROOT / "services" / "itinerary-service" / "app"

for p in (str(SHARED_DIR), str(ITINERARY_APP_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

from planner import (  # noqa: E402
    _haversine_km,
    total_route_distance,
    optimize_route_2opt,
    order_nearest_neighbour,
    compute_route_routing,
    generate_plan,
    resequence_plan,
)


def test_haversine_and_total_route_distance():
    a = {"lat": 12.9716, "lng": 77.5946}  # MG Road, Bangalore
    b = {"lat": 12.9352, "lng": 77.6245}  # Koramangala, Bangalore
    dist = _haversine_km(a, b)
    assert 4.0 < dist < 7.0

    start = {"lat": 12.9716, "lng": 77.5946}
    route = [
        {"id": 1, "lat": 12.9750, "lng": 77.6000},
        {"id": 2, "lat": 12.9800, "lng": 77.6100},
    ]
    tot = total_route_distance(route, start)
    assert tot > 0.0
    assert total_route_distance([], start) == 0.0


def test_2opt_untangles_crossing_route():
    # Construct a bow-tie / crisscrossed polygon path:
    # Start at (0, 0)
    # Stop 1: (10, 0)
    # Stop 2: (0, 10)
    # Stop 3: (10, 10)
    # The naive path 1 -> 3 -> 2 crosses over itself.
    # The untangled path 1 -> 3 -> 2 vs 2 -> 3 -> 1.
    start_lat, start_lng = 0.0, 0.0
    start = {"lat": start_lat, "lng": start_lng}

    # Deliberately inverted order that crisscrosses
    p1 = {"id": 1, "lat": 1.0, "lng": 0.0}
    p2 = {"id": 2, "lat": 2.0, "lng": 1.0}
    p3 = {"id": 3, "lat": 1.0, "lng": 1.0}
    p4 = {"id": 4, "lat": 2.0, "lng": 0.0}

    # Crossed order: p1 -> p2 -> p3 -> p4
    crossed_route = [p1, p2, p3, p4]
    crossed_dist = total_route_distance(crossed_route, start)

    optimized = optimize_route_2opt(crossed_route, start_lat, start_lng)
    opt_dist = total_route_distance(optimized, start)

    assert len(optimized) == 4
    assert {p["id"] for p in optimized} == {1, 2, 3, 4}
    assert opt_dist <= crossed_dist


def test_order_nearest_neighbour_empty_and_single():
    assert order_nearest_neighbour([], 12.97, 77.59) == []
    single = [{"id": 42, "lat": 12.97, "lng": 77.59}]
    assert order_nearest_neighbour(single, 12.97, 77.59) == single


def test_order_nearest_neighbour_places():
    start_lat, start_lng = 12.9716, 77.5946
    places = [
        {"id": 10, "lat": 12.9352, "lng": 77.6245, "name": "Koramangala Stop"},
        {"id": 11, "lat": 12.9720, "lng": 77.5950, "name": "Nearby MG Road Stop"},
        {"id": 12, "lat": 12.9780, "lng": 77.6400, "name": "Indiranagar Stop"},
    ]
    ordered = order_nearest_neighbour(places, start_lat, start_lng)
    assert len(ordered) == 3
    # Nearest stop should be visited first
    assert ordered[0]["id"] == 11


def test_compute_route_routing():
    p1 = {"id": 1, "lat": 12.9716, "lng": 77.5946, "name": "MG Road"}
    p2 = {"id": 2, "lat": 12.9352, "lng": 77.6245, "name": "Koramangala"}
    routing = compute_route_routing([p1, p2])
    assert routing is not None
    assert routing["total_distance_km"] > 0
    assert routing["total_duration_min"] > 0
    assert len(routing["legs"]) == 1
    assert routing["provider"] in ("locationiq", "haversine_estimate")


def test_resequence_and_generate_plan_routing():
    p1 = {"id": 1, "lat": 12.9716, "lng": 77.5946, "name": "Place 1", "category": "cafe"}
    p2 = {"id": 2, "lat": 12.9352, "lng": 77.6245, "name": "Place 2", "category": "restaurant"}
    p3 = {"id": 3, "lat": 12.9780, "lng": 77.6400, "name": "Place 3", "category": "park"}

    # Resequence plan maintains exact order
    plan = resequence_plan(
        places=[p3, p1, p2],
        occasion="romantic",
        duration="4-6 hours",
        budget="medium",
        start_time=None,
    )
    assert [p["id"] for p in plan["places"]] == [3, 1, 2]
    assert "routing" in plan
    assert len(plan["routing"]["legs"]) == 2
    # Verify travel_to_next on items and timeline
    assert "travel_to_next" in plan["items"][0]
    assert plan["items"][0]["travel_to_next"]["distance_km"] > 0
