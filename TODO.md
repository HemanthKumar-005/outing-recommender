# Project Roadmap & Actionable To-Do List

This document outlines the exact technical tasks required to advance the **Outing Recommender Platform** from its current stage to a production-grade, high-performance system. Tasks are categorized by priority and domain, with explicit data requirements identified.

---

## 🚀 1. Immediate System & ML Fixes (High Priority)

- [x] **Wire Trained XGBoost Model into Live Inference**
  - **Issue**: In `services/recommendation-engine/app/main.py` (line 182), the machine learning component was hardcoded (`"ml": 0.5`) instead of scoring with the trained booster.
  - **Action**:
    - Added `xgboost` and dependencies to `services/recommendation-engine/requirements.txt`.
    - Implemented `ModelManager` with thread-safe locking, startup validation, batched inference, atomic hot-reload on `model.updated`, and safe 0.5 fallback.
    - Extracted 10-dimensional feature vectors using `shared/features.py::build_feature_vector()` for candidate places and fed into `booster.predict()`.
    - Added AI explanation reason (`"Strong match predicted by AI model"`) for scores $\ge 0.65$.
    - Verified via unit test suite in `services/recommendation-engine/tests/test_model_scoring.py`.

- [x] **Persist Container Fixes across Docker Builds**
  - **Issue**: Docker build of `model-training-worker` and `api-gateway` suffered from temporary DNS/pip timeouts during wheel compilation.
  - **Action**:
    - Pinned binary wheel tags (`manylinux`) in `requirements.txt` to avoid on-the-fly source compilation.
    - Added `--prefer-binary`, `--retries 5`, `--timeout 120` to Dockerfiles.
    - Fixed `CORSMiddleware` in `services/api-gateway/app/main.py` (`allow_credentials=True` with explicit origins `http://localhost:3000`, `http://127.0.0.1:3000`).
    - Verified via unit test suite in `services/api-gateway/tests/test_cors.py`.

- [x] **Transition Model Training from Synthetic to Real Logs**
  - **Issue**: `services/model-training-worker/train.py` previously trained only on synthetic random numbers (`synthesize_dataset`).
  - **Action**:
    - Implemented PostgreSQL database extractor query pulling chronological rows from `interactions`, `places`, and `users`.
    - Mapped binary labels: positive ($y=1$) from `visit`, `save`, `share`, `rating >= 4.0`; negative ($y=0$) from `skip` or `rating <= 2.0`; neutral rows excluded.
    - Built leakage-free chronological feature calculation for popularity, CF co-occurrences, CBF cosine similarity, and context.
    - Added 80/20 temporal split and metrics logging (ROC-AUC, Precision, Recall, F1).
    - Added automatic fallback to synthetic generation if usable real samples $< 1,000$ or single-class.
    - Configured `DATABASE_URL` and `postgres` healthcheck in `docker-compose.yml`.
    - Verified via unit test suite in `services/model-training-worker/tests/test_train.py`.

---

## 📊 2. Datasets Required to Improve Recommendation Performance

To move beyond baseline coverage, the following datasets are needed:

### A. Point of Interest (POI) & Venue Dataset (Pan-India)
* **Current State**: 310 curated places across 93 cities (~3.3 places/city). Enriched with day-by-day opening hours, pricing indicators (`cost_for_two`, `entry_fee`), and source tracking (`data/enrichment_report.json`, `shared/hours_pricing.py`, `scripts/enrich_places.py`).
* **Target State**: 30–100 curated venues per tier-1/tier-2 city (minimum 3,000–5,000 places total).
* **Required Data Attributes**:
  * Accurate latitude & longitude (WGS84).
  * Day-by-day opening hours (`{"mon": [["09:00", "22:00"]], ...}`) to support `time_suitability` filtering.
  * Price range / cost for two (scale 0–4 or INR amounts).
  * Atmosphere/ambience tags (e.g., `rooftop`, `cozy`, `lively`, `quiet`, `heritage`, `scenic`).
  * Group suitability tags (`couple_friendly`, `family_friendly`, `friends_friendly`, `solo`).
  * Indoor / outdoor classification for weather-aware filtering.
* **Recommended Sources**:
  * Google Places API (via bulk search extraction or curated CSV exports).
  * OpenStreetMap (OSM) Overpass API (extracting `amenity=restaurant`, `tourism=attraction`, `leisure=park` across India).
  * Zomato / Swiggy public venue listings for dining and nightlife.

### B. User Interaction & Implicit Feedback Dataset
* **Current State**: Seed and mock interaction pipelines established; positive/negative conversion label mapping and chronological leak-free extractor integrated into `model-training-worker`.
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
- [x] **Instant Feedback Loop**
  - Added "♥ Like" and "✕ Skip" buttons on recommendation cards connected to `/api/interactions/events` via `apiFetch()` for instant user preference tracking, card exclusion, and visual toasts.
- [x] **Model Card & Explainability Modal**
  - Surfaced multi-factor reason chips (`reason-chip`) prominently on recommendation cards (including AI prediction matches $\ge 0.65$, occasion suitability, and weather fit) alongside an expandable "Why this?" score breakdown drawer.

---

## 🛡️ 5. Infrastructure & Operations

- [x] **Automate Database Migrations**
  - Added versioned, idempotent SQL migration pipeline in `postgres/migrations/` (e.g., `001_add_hours_and_pricing.sql`) to safely evolute Postgres schemas without dropping volumes or losing data.
- [x] **Set up Automated Model Retraining Daemon / Schedule**
  - Implemented configurable continuous background daemon loop in `services/model-training-worker/train.py` (`DAEMON_MODE=true` with sleep and RabbitMQ event notification) wired into `docker-compose.yml`.
- [ ] **Production SSL & Domain Binding**
  - Run certbot on production host to acquire valid Let's Encrypt certificates as documented in `deploy/README.md`.
