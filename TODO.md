# Project Roadmap & Actionable To-Do List

This document outlines the exact technical tasks required to advance the **Outing Recommender Platform** from its current stage to a production-grade, high-performance system. Tasks are categorized by priority and domain, with explicit data requirements identified.

---

## 🚀 1. Immediate System & ML Fixes (High Priority)

- [ ] **Wire Trained XGBoost Model into Live Inference**
  - **Issue**: In `services/recommendation-engine/app/main.py` (line 182), the machine learning component is hardcoded (`"ml": 0.5`) instead of scoring with the trained booster.
  - **Action**:
    - Add `xgboost` to `services/recommendation-engine/requirements.txt`.
    - Load `/models/xgboost_model.json` on engine startup.
    - Subscribe to RabbitMQ topic `model.updated` to hot-reload the booster without container downtime.
    - Extract real 10-dimensional feature vectors using `shared/features.py::build_feature_vector()` for candidate places and feed into `booster.predict()`.

- [ ] **Persist Container Fixes across Docker Builds**
  - **Issue**: Docker build of `model-training-worker` and `api-gateway` suffered from temporary DNS/pip timeouts during wheel compilation.
  - **Action**:
    - Pre-bundle wheels or pin binary wheel tags (`manylinux`) in `requirements.txt` to avoid on-the-fly source compilation.
    - Verify `CORSMiddleware` in `services/api-gateway/app/main.py` handles preflight `OPTIONS` requests from `http://localhost:3000` cleanly.

- [ ] **Transition Model Training from Synthetic to Real Logs**
  - **Issue**: `services/model-training-worker/train.py` currently trains on synthetic random numbers (`synthesize_dataset`).
  - **Action**:
    - Implement a database extractor query that pulls historical rows from `interactions`, `places`, and `users` tables.
    - Form positive binary labels ($y=1$) from `visit`, `save`, `rating >= 4`, `share` and negative labels ($y=0$) from `skip` or low ratings.
    - Fallback gracefully to synthetic bootstrap only if total interaction count is $< 1,000$.

---

## 📊 2. Datasets Required to Improve Recommendation Performance

To move beyond baseline coverage, the following datasets are needed:

### A. Point of Interest (POI) & Venue Dataset (Pan-India)
* **Current State**: 310 places across 93 cities (~3.3 places/city).
* **Target State**: 30–100 curated venues per tier-1/tier-2 city (minimum 3,000–5,000 places total).
* **Required Data Attributes**:
  * Accurate latitude & longitude (WGS84).
  * Day-by-day opening hours (`{"mon": ["09:00", "22:00"], ...}`) to support `time_suitability` filtering.
  * Price range / cost for two (scale 0–4 or INR amounts).
  * Atmosphere/ambience tags (e.g., `rooftop`, `cozy`, `lively`, `quiet`, `heritage`, `scenic`).
  * Group suitability tags (`couple_friendly`, `family_friendly`, `friends_friendly`, `solo`).
  * Indoor / outdoor classification for weather-aware filtering.
* **Recommended Sources**:
  * Google Places API (via bulk search extraction or curated CSV exports).
  * OpenStreetMap (OSM) Overpass API (extracting `amenity=restaurant`, `tourism=attraction`, `leisure=park` across India).
  * Zomato / Swiggy public venue listings for dining and nightlife.

### B. User Interaction & Implicit Feedback Dataset
* **Current State**: No seed interaction data; collaborative filtering (CF) stays dormant ($0\%$ weight).
* **Target State**: Benchmark dataset of user-item interactions to train and validate collaborative filtering and ranking models.
* **Required Attributes**: `(user_id, place_id, interaction_type, rating, timestamp, context)`.
* **Recommended Benchmarks**:
  * **Yelp Open Dataset**: Rich user reviews, check-ins, business attributes, and star ratings.
  * **Foursquare Location-Based Social Network (LBSN) Dataset**: Real user check-in sequences, venue categories, and timestamps (ideal for itinerary sequence planning).
  * **TripAdvisor Restaurant & Attraction Dataset**: Rich ratings across ambience, service, and value.

### C. Review Sentiment Dataset
* **Current State**: Synthetic review strings scored against a hardcoded positive/negative word lexicon in `sentiment-worker`.
* **Target State**: Real customer review snippets analyzed with a modern NLP transformer.
* **Recommended Solution**:
  * Ingest 20–50 real customer reviews per venue.
  * Replace the keyword dictionary with a quantized local model (e.g., `cardiffnlp/twitter-roberta-base-sentiment-latest` or `distilbert-base-uncased-finetuned-sst-2-english`) or HuggingFace pipeline.

### D. Urban Travel Time & Routing Matrix Data
* **Current State**: Euclidean / Haversine straight-line distance (`_haversine()`).
* **Target State**: Real road distance and expected transit time accounting for urban traffic.
* **Recommended Solution**:
  * Integrate an Open Source Routing Machine (OSRM) local container (`osrm-backend`) or TomTom / MapmyIndia / Google Distance Matrix API for accurate itinerary travel time estimation between consecutive stops.

---

## 🧠 3. Algorithm & Model Enhancements

- [ ] **Collaborative Filtering Upgrade**
  - Current item co-occurrence overlap is heuristic.
  - Implement Matrix Factorization (Truncated SVD / LightFM) or Implicit Alternating Least Squares (iALS) for sparse user-item interaction matrices.
- [ ] **Context-Aware Dynamic Weighting**
  - Integrate live open-meteo weather API calls inside `context-service` instead of simulated weather stubs.
  - Weight temperature and rainfall dynamically based on venue's `indoor_outdoor` attribute.
- [ ] **Sequence Optimization for Itineraries**
  - Current itinerary planner builds slots based on predefined template categories.
  - Implement a Travelling Salesperson Problem (TSP) solver / 2-opt route heuristic to minimize total travel time between morning, afternoon, evening, and night venue stops.

---

## 🎨 4. Frontend & User Experience (Next.js)

- [ ] **Interactive Preference & Weight Sliders**
  - Connect user preference sliders in UI to `merge_weight_overrides` API endpoint, enabling users to adjust their priority (e.g., "Care more about Distance, less about Popularity").
- [ ] **Group Outing Mode**
  - Build a multi-user selection interface in Date Planner to trigger `aggregate_group_scores` with consensus strategies (`least_misery`, `average`, `borda`).
- [ ] **Instant Feedback Loop**
  - Add "Like", "Save", and "Skip" buttons on recommendation cards to post directly to `/api/recommendations/{session_id}/feedback` for instant in-session re-ranking.
- [ ] **Model Card & Explainability Modal**
  - Surface the reasons list (`reasons: [...]`) prominently on place cards (e.g., "Within your budget", "Great for rainy weather", "Positive reviews").

---

## 🛡️ 5. Infrastructure & Operations

- [ ] **Automate Database Migrations**
  - Add Alembic or versioned SQL migration scripts to manage changes in Postgres schema without recreating volumes.
- [ ] **Set up Automated Model Retraining Cron**
  - Configure a cron job or Celery beat task to trigger `model-training-worker` nightly once new interactions exceed threshold ($N \ge 100$).
- [ ] **Production SSL & Domain Binding**
  - Run certbot on production host to acquire valid Let's Encrypt certificates as documented in `deploy/README.md`.
