# Nearby & Co. — Outing Recommendation Platform

A multi-tenant microservices implementation of a context-aware outing
recommender: candidate generation, content-based filtering, collaborative
filtering, XGBoost scoring, context/group/exploration fusion, and an
explainable, live-re-rankable ranked list, plus itinerary planning with
closed-loop feedback and weather-reactive swaps. Every tenant's data (users,
places, interactions, notifications, itineraries) is isolated by PostgreSQL
row-level security, not application-level filtering.

## Services

| Service | Port (host) | Storage | Notes |
|---|---|---|---|
| api-gateway | 8000 | - | Resolves X-API-Key to a tenant via platform.tenants, forwards X-Tenant-Id downstream, per-tenant Redis rate limiting + GET /places caching, POST /tenants self-serve signup |
| user-service | 8001 | Postgres users schema | Profiles: budget, categories, ambience, age group, preferred distance/outing type |
| place-service | 8002 | Postgres places schema | Catalog, geo search (haversine), sentiment/popularity/review fields |
| context-service | 8003 | - | Weather (live via Open-Meteo, deterministic mock fallback) + time-of-day/weekday. Not tenant-scoped since weather isn't tenant data |
| interaction-service | 8004 | Postgres interactions schema | view/click/save/visit/rating/share/skip events, publishes to the bus |
| recommendation-engine | 8005 | Redis (session cache only) | Orchestrates candidate gen + CBF + CF + XGBoost + context/group/diversity fusion; no database of its own |
| itinerary-service | 8006 | Postgres itineraries schema | Greedy nearest-neighbour scheduling; background workers for feedback reminders + weather-reactive swaps |
| notification-service | 8007 | Postgres notifications schema | Consumes notification.send events, simulates delivery |
| model-training-worker | - | - | One-off job: synthesizes training data, trains XGBoost, publishes model.updated. Not tenant-specific - one shared model across all tenants (documented simplification, see below) |
| sentiment-worker | - | - | Sweeps every tenant's catalog (via worker_role) + reacts to place.updated, scores synthetic reviews with a lexicon |
| postgres | 5432 | - | One database (outing), one schema per service, RLS on every tenant-owned table |
| rabbitmq | 5672 / 15672 | - | Event bus (topic exchange events); management UI at :15672 (guest/guest) |
| redis | 6379 | - | Gateway rate-limit/cache/API-key cache, context-service weather cache, recommendation session cache |
| frontend | 3000 | - | Next.js - recommendation form, live ticket-stub results, model card, tenant signup |

All inter-service calls happen through each service's own REST API - nothing
reaches into another service's database directly. Every internal HTTP call
(gateway to service, recommendation-engine to place/user/interaction-service,
itinerary-service to place-service, sentiment-worker to place-service) carries
an explicit X-Tenant-Id header, since these bypass the gateway and can't
rely on it to inject tenant context.

## Multi-tenancy and row-level security

The design: one Postgres database (outing), one schema per service
(users, places, interactions, notifications, itineraries), every
tenant-owned table has a tenant_id UUID column with:

```sql
ALTER TABLE users.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users.users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users.users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Full schema + policies: `postgres/init.sql`.

Why this actually isolates tenants, not just filters queries:
- Services connect as `app_role`, a non-superuser, NOBYPASSRLS role
  that does not own the tables it queries. Both matter - table owners and
  superusers bypass RLS by default in Postgres, so a role that did own
  these tables would silently see every tenant's rows regardless of the
  policy.
- Every query runs inside `shared/pgdb.py::tenant_cursor(tenant_id)`, which
  sets `SET LOCAL app.tenant_id = <tenant_id>` as the first statement of
  the transaction, before any application code touches the database. There
  is no code path in any service that can execute a query without this set
  first - db.py in each service has no lower-level "raw" query function
  that skips it.
- The isolation is enforced by Postgres itself. A bug in a service's WHERE
  clause (e.g. forgetting a tenant_id filter, which is exactly the
  mistake app-level multi-tenancy is one typo away from) cannot leak
  another tenant's rows - RLS applies to every statement against the table,
  filter or no filter.
- Two more roles exist for the one legitimate cross-tenant need
  (enumerating tenants for background sweeps) and API-key resolution:
  gateway_role (SELECT+INSERT on platform.tenants only) and worker_role
  (SELECT on platform.tenants only). Neither has any grant on a tenant
  schema - they can list tenant IDs but can't read a single row of tenant
  data.

Tenant resolution flow: X-API-Key goes to api-gateway, which looks it up in
platform.tenants (cached in Redis for 30s), resolves it to a tenant_id, and
forwards it as X-Tenant-Id on the proxied request. Every downstream service
depends on shared/tenant.py::require_tenant, which 400s if the header is
missing or not a valid UUID.

Try it: `POST /tenants {"name": "..."}` on the gateway (also exposed via
the frontend's /signup page) provisions a brand-new, fully isolated
workspace and returns its API key - no other tenant's users, places,
interactions, or itineraries are ever visible through it.

Documented simplification: model-training-worker trains one XGBoost
model shared across every tenant (the training data is synthetic anyway, see
below). A genuinely premium per-tenant model would need real per-tenant
interaction volume to train on - reasonable to add once a tenant has enough
data, not before.

## What makes this different from a generic "things to do" list

- Group consensus, not single-user picks - a request can carry multiple
  user_ids; each guest's fused score is combined via least_misery,
  average, or borda (scoring.py::aggregate_group_scores), so one
  person's taste can't dominate an outing for four.
- Explore/exploit dial - a diversity parameter runs a greedy
  MMR-style re-rank (scoring.py::diversify) that trades relevance for
  variety across category/ambience, user-controlled via a slider in the UI.
- Live re-ranking within a session - POST /recommendations/{session_id}/feedback
  with skip/like re-ranks the cached candidate pool in Redis instantly,
  no full re-query, no page reload.
- Closed feedback loop - itinerary-service's background workers detect
  when a planned stop's visit window has passed and the guest hasn't rated
  it, and fire a reminder via notification.send - closing the loop back
  into real interaction data instead of staying synthetic forever.
- User-facing explainability - every result ships a score_breakdown
  (CBF/CF/context/ML/popularity/exploration) and a plain-language reasons
  list, both rendered in the UI ("Why this?" and the model card page), not
  buried in logs.
- Weather-reactive itinerary swaps - itinerary-service re-checks weather
  for upcoming outdoor stops and proactively suggests an indoor alternative
  before the guest arrives, not just once at planning time.
- Place-side cold start - a small UCB-style exploration bonus
  (scoring.py::exploration_bonus) for low-review-count places, so new
  venues aren't permanently buried under already-popular ones.
- A public model card - GET /model-card (and the /model-card page)
  surfaces the live model version, training metadata, current ranking
  weights per cold-start profile, and the last offline evaluation/ablation
  run. No black box.

## Event topics (RabbitMQ topic exchange `events`)

- user.updated - profile/preferences changed (carries tenant_id)
- place.updated - place created or sentiment updated (carries tenant_id)
- interactions - every tracked interaction (carries tenant_id)
- model.updated - new model version ready, recommendation-engine hot-reloads (not tenant-scoped)
- notification.send - notification-service delivers (carries tenant_id)

## Running it

Requires Docker + Docker Compose. This was authored without a live Docker
environment on hand, so double-check `docker compose build` end-to-end and
share any error output if something doesn't line up - happy to fix.

```bash
docker compose up --build -d
# postgres/init.sql runs automatically on first startup: creates schemas,
# RLS policies, roles, and seeds a demo tenant (API key "demo-key")

# Train the toy model once RabbitMQ/place data is up (safe to re-run any time)
docker compose run --rm model-training-worker

# Seed sample users/places/interactions for the demo tenant, through the gateway
pip install requests
python3 scripts/seed_data.py

# Open the frontend
open http://localhost:3000
# or provision your own isolated workspace: http://localhost:3000/signup

# Or ask for recommendations directly
curl -H 'X-API-Key: demo-key' -H 'Content-Type: application/json' \
  -X POST http://localhost:8000/api/recommendations/recommendations \
  -d '{"user_id": 1, "lat": 12.9716, "lng": 77.5946, "radius_km": 8, "outing_type": "friends", "top_k": 5}'

# Build an itinerary from a chosen set of places
curl -H 'X-API-Key: demo-key' -H 'Content-Type: application/json' \
  -X POST http://localhost:8000/api/itinerary/itinerary \
  -d '{"user_id": 1, "places": [{"id":1,"name":"Blue Tokai","category":"cafe","lat":12.97,"lng":77.59}],
       "start_time": "2026-08-15T10:00:00", "end_time": "2026-08-15T18:00:00"}'

# Run the offline evaluation + ablation study
pip install numpy xgboost scikit-learn
python3 scripts/evaluate.py

# Provision a second, fully isolated tenant and confirm it sees nothing
# from the demo tenant
curl -X POST http://localhost:8000/tenants -H 'Content-Type: application/json' -d '{"name": "Test Co"}'
```

Every service also exposes /health (liveness) and /ready (dependency
check). Postgres, RabbitMQ, and Redis are also reachable on their host ports
for debugging. Ranking weights live in configs/ranking.yaml (mounted
read-only into recommendation-engine) - edit and restart the container to
retune without a rebuild.

## Recommendation pipeline (recommendation-engine)

1. Candidate generation - place-service /places/nearby with a
   bounding-box pre-filter + haversine distance, budget range, and open-now
   filtering (RLS-scoped to the requesting tenant).
2. Content-based filtering - cosine similarity between a guest's
   preferred-category/ambience vector and each candidate's vector.
3. Collaborative filtering - lightweight item-based co-occurrence: how
   much overlap exists between guests who liked a candidate and guests who
   liked places this guest already likes.
4. Context scoring - ContextScore = a*Weather + b*Time + c*Budget +
   d*Group, so weather/budget/outing-type actually change ranking (an
   outdoor place gets penalized when it's raining) rather than only being
   displayed. Sub-weights live in configs/ranking.yaml.
5. ML scoring - a small XGBoost binary classifier (shared/features.py
   defines the 10-feature schema shared by training and inference) predicts
   an engagement-likelihood score per candidate.
6. Score fusion + exploration bonus - a config-driven weighted sum of
   XGBoost, CBF, CF, distance-decay, sentiment, popularity, and context, plus
   a small boost for low-review-count places.
7. Cold-start branching - guests with fewer than
   cold_start.min_interactions_for_cf positive interactions get the
   new_user weight profile (CF weight = 0), so collaborative filtering
   never blocks a first-time guest's recommendations.
8. Group aggregation (if user_ids has more than one entry) - per-guest
   fused scores combined via least-misery / average / borda.
9. Diversity re-rank - an MMR-style pass trading relevance for variety,
   strength set by the diversity request param.
10. Explanations - each result includes a reasons list, e.g. "Within
    your budget", "Good fit for current weather", "Popular with similar
    guests".
11. Session caching - the full ranked pool is cached in Redis under a
    session_id, enabling live skip/like re-ranking without a full re-query.

The XGBoost model ships untrained - run model-training-worker once (it
synthesizes a plausible labeled dataset since there's no real interaction
history yet) to get real scores; before that, the engine falls back to a
neutral 0.5 XGBoost component so the rest of the pipeline still ranks
candidates on CBF/CF/context/distance/sentiment alone. Trained models are
versioned: xgboost_model.meta.json (version, training date, dataset
version, feature version, validation metrics) is checked via GET
/api/recommendations/model-info, or the full model card at GET
/api/recommendations/model-card.

## What's simplified vs. a production system

- One shared XGBoost model across all tenants (see above) - per-tenant
  models are a natural next step once a tenant has enough real interaction
  volume.
- One shared app_role credential across the five tenant-scoped
  services - a production system would likely mint separate DB credentials
  per service (still all RLS-scoped identically) for defense in depth; this
  demo trades that for simpler setup.
- API-key tenant cache is 30s TTL in Redis, not instantly revocable - a
  production system would want an explicit revocation path that busts the
  cache, not just a short TTL.
- Sentiment analysis runs over synthetically generated review text
  (there's no real review corpus available) using a small lexicon, not a
  downloaded NLTK model - keeps it dependency-free and deterministic.
- Collaborative filtering is a simple co-occurrence heuristic, not
  matrix factorization / ALS - swap in implicit or a nightly batch job as
  interaction volume grows.
- No real payments/billing on top of the tenant model - POST /tenants
  provisions a workspace but doesn't attach a plan or usage metering.
