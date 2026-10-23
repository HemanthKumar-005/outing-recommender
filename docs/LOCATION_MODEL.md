Location & recommendation model (pan-India)
Principle
Recommendations are always computed from:

Where the user wants to go (city from the India location index, or lat/lng)
User preferences (occasion, categories, budget, outing type)
Places in the tenant DB near that point (radius search)
Nothing is hard-coded to a single state or a fixed venue list.

Two different configs (do not merge / duplicate)
File	Purpose	Used for recommendations?
configs/india_locations.yaml	State → city → lat/lng picker index	Only to resolve "I want to explore Pune" → coordinates
data/places_catalog.yaml	Sample places for local demo seeding	Seed only; production tenants load their own catalog
Do not put full venue catalogs in india_locations.yaml. Do not re-implement city lists in the frontend — use GET /api/places/locations.

Request flow
User picks State + City (LocationPicker)
    → places/locations or locations/resolve
    → lat, lng, radius_km (default from india_locations.yaml)
    → POST recommendations  OR  GET places/search
    → rank by occasion/preferences (configs/occasions.yaml + ranking.yaml)
Extending coverage
More cities in the picker: edit configs/india_locations.yaml only.
More places to recommend: insert into places.places (API or seed), with lat/lng/city/state.
New occasions: edit configs/occasions.yaml only.
Reuse (avoid duplicate work)
LocationPicker — use on Discover, Date Planner, any flow that needs a destination
shared/config_loader.py — single loader for all YAML
shared/occasion_scoring.py — single scorer
place-service /search — single geo search; recommendation-engine calls it (does not re-query raw tables itself for candidates)