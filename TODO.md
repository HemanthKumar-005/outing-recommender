# Project Roadmap & Actionable To-Do List

This document outlines the complete architectural state and actionable technical roadmap for the **Outing Recommender Platform**. It details all verified completed components alongside an exhaustive, prioritized inventory of all tasks **yet to be done** to bring the platform to full production readiness (excluding hosting/deployment infrastructure for now).

---

## 📈 1. Executive Status & Progress Dashboard

| Subsystem / Layer | Current Status | Test Coverage | Key Implemented Deliverables |
| :--- | :---: | :---: | :--- |
| **Live XGBoost Inference** | ✅ Completed | 4/4 passing | `ModelManager` atomic hot-reload, batched inference, AI prediction reason chips ($\ge 0.65$) |
| **Real Log Model Training** | ✅ Completed | 4/4 passing | PostgreSQL chronological extractor, positive/negative conversion labels, 80/20 temporal split |
| **Container & CORS Stability** | ✅ Completed | 2/2 passing | Pinned `manylinux` wheels, credentials support for `localhost:3000` |
| **POI Enrichment (Hours & Pricing)** | ✅ Completed | 4/4 passing | 310 Pan-India venues enriched with weekly hours, price tiers, and SQL schema migrations |
| **Google Maps & Geospatial Explorer** | ✅ Completed | Verified (17 routes) | `GoogleMapView.tsx`, Split/Map/Cards layout toggle, Sequenced route polylines, OSM zero-crash fallback |
| **Interaction Ingestion & Events** | ✅ Completed | Fully wired | Dual `/interactions` & `/events` endpoints, like/skip persistence, RabbitMQ event dispatch |
| **Model Retraining Daemon** | ✅ Completed | Fully wired | Background daemon loop in worker with sleep interval and RabbitMQ topic notification |
| **Algorithmic TSP Route Solver** | ⏳ Pending | Next milestone | 2-opt / TSP sequence heuristic in `itinerary-service` to minimize multi-stop driving time |
| **Live Collaborative Filtering (CF)** | ⏳ Pending | Next milestone | Wire `cf_scores()` into live inference pipeline using co-occurrence interaction matrix |
| **Context Weather Dynamic Weights** | ⏳ Pending | Next milestone | Live Open-Meteo temperature & rain severity scaling inside `context_score()` |
| **Dynamic Sliders & Group Consensus** | ⏳ Pending | Next milestone | Interactive UI sliders for `merge_weight_overrides` and multi-persona group consensus |
| **NLP Transformer Sentiment Worker** | ⏳ Pending | Backlog | Replace keyword dictionary in `sentiment-worker` with a local HuggingFace transformer |

---

## 🚀 2. Verified Completed Deliverables

### A. Machine Learning & Inference Pipeline
- [x] **Wire Trained XGBoost Model into Live Inference**
  - Implemented `ModelManager` in `services/recommendation-engine/app/model.py` with thread-safe locking, startup validation, batched inference, and atomic hot-reload on `model.updated`.
  - Extracted 10-dimensional feature vectors (`shared/features.py::build_feature_vector`) for candidate places and fed into booster predictions.
  - Added AI explanation reason (`"Strong match predicted by AI model"`) for scores $\ge 0.65$.
  - Unit tests verified: `services/recommendation-engine/tests/test_model_scoring.py` (4/4 passing).

- [x] **Transition Model Training from Synthetic to Real Logs**
  - Implemented PostgreSQL database extractor query in `services/model-training-worker/train.py` pulling chronological rows from `interactions`, `places`, and `users`.
  - Mapped binary labels: positive ($y=1$) from `visit`, `save`, `share`, `rating >= 4.0`; negative ($y=0$) from `skip` or `rating <= 2.0`; neutral rows excluded.
  - Built leakage-free chronological feature calculation for popularity, CF co-occurrences, CBF cosine similarity, and context.
  - Added 80/20 temporal split and metrics logging (ROC-AUC, Precision, Recall, F1).
  - Added automatic fallback to synthetic generation if usable real samples $< 1,000$ or single-class.
  - Unit tests verified: `services/model-training-worker/tests/test_train.py` (4/4 passing).

- [x] **Automated Model Retraining Daemon**
  - Added configurable background daemon loop in `services/model-training-worker/train.py` (`DAEMON_MODE=true` with sleep interval and RabbitMQ event notification) wired into `docker-compose.yml`.

### B. Catalog Enrichment & Schema Migrations
- [x] **Pan-India Venue Catalog Enrichment**
  - Enriched 310 places across 93 cities with structured weekly opening hours (`{"mon": [["09:00", "22:00"]], ...}`) and real pricing indicators (`cost_for_two`, `entry_fee`).
  - Added idempotent SQL migration in `postgres/migrations/001_add_hours_and_pricing.sql`.
  - Unit tests verified: `services/recommendation-engine/tests/test_hours_and_scoring.py` (4/4 passing).

### C. Geospatial Visualization & Frontend UX
- [x] **Interactive Google Maps Explorer & Route Visualization**
  - Built `frontend/components/GoogleMapView.tsx` (369 lines) supporting marker placement, custom InfoWindows, route polylines, and dynamic viewport bounds fitting.
  - Added view toggle pills (`☰ Cards`, `◫ Split`, `🗺️ Map`) in `frontend/components/RecommendPanel.tsx` enabling synchronized browsing where hovering cards highlights corresponding markers.
  - Integrated sequential route visualization into Date Planner (`frontend/components/DatePlanner/PlanDisplay.tsx`), linking multi-stop outings with sequenced arrows, numbered badges, and direct navigation links.
  - Built resilient zero-crash fallback: intercepts `window.gm_authFailure` and Google script load errors, automatically rendering an interactive OpenStreetMap view with status badges.
  - Production build verified: Next.js 14 cleanly compiles all 17 routes.

### D. Gateway & Inter-Service Stability
- [x] **Docker Container Build & CORS Stability**
  - Pinned binary wheel tags (`manylinux`) in `requirements.txt` to avoid on-the-fly source compilation timeouts.
  - Fixed `CORSMiddleware` in `services/api-gateway/app/main.py` (`allow_credentials=True` with explicit origins `http://localhost:3000`, `http://127.0.0.1:3000`).
  - Unit tests verified: `services/api-gateway/tests/test_cors.py` (2/2 passing).

- [x] **Dual Interaction Ingestion Endpoints**
  - Updated `services/interaction-service/app/main.py` to support both `/interactions` and `/events` endpoints, accepting either `type` or `event_type` payload keys to ensure seamless compatibility with frontend card like/skip actions.

---

## 📊 3. Required Datasets for ML Training & POI Ingestion (Types, Schemas & Fetch Guide)

To train high-performing ranking models, evaluate collaborative filtering, and expand venue coverage across India, the following specific dataset types are required:

### 🎯 Dataset Type 1: User-POI Interaction & Behavior Logs
* **Role in Pipeline**: Directly feeds the **XGBoost Re-ranking Booster** (`model-training-worker/train.py`), the **Collaborative Filtering Engine** (`scoring.py::cf_scores`), and the **Offline Evaluation Harness** (`scripts/evaluate.py`).
* **Required Data Attributes & Schema (CSV / JSON)**:
  | Column Name | Data Type | Example Value | Description |
  | :--- | :--- | :--- | :--- |
  | `user_id` | Integer / String | `1042` | Unique ID of the interacting user |
  | `place_id` | Integer / String | `87` | ID matching the venue catalog |
  | `type` | String | `save`, `visit`, `rating`, `skip`, `view` | Action type ($y=1$ for save/visit/rating $\ge 4$, $y=0$ for skip/rating $\le 2$) |
  | `rating` | Float (1.0–5.0) | `4.5` (or null) | Explicit star rating given by user |
  | `timestamp` | ISO Datetime | `2026-10-12T19:30:00Z` | Crucial for chronologically sorted 80/20 train/test splits without leakage |
  | `context` | JSON Object | `{"weather": "clear", "time_of_day": "evening"}` | Environmental context at interaction time |
* **Best Ready-to-Fetch Public Benchmarks**:
  1. **Foursquare Location-Based Social Network (LBSN) Dataset**: Contains millions of real check-in sequences, venue categories, user IDs, and timestamps. Perfect for sequential recommendation and collaborative filtering. Available on Kaggle or University of Minnesota GroupLens repository.
  2. **Yelp Open Dataset (`review.json` & `user.json`)**: 7+ million user ratings, check-ins, timestamps, and reviews across dining and entertainment venues. Downloadable directly from Yelp Dataset portal.
  3. **Google Local Reviews (UCSD McAuley Lab)**: Extensive state-by-state Google Maps user interaction and review datasets with user ID, place ID, ratings, and timestamps.
  4. **Zomato Restaurant Reviews & Ratings (Kaggle)**: India-specific dining reviews and ratings across Bangalore, Mumbai, and Delhi.
* **Easy Ingestion Method**: Ingest directly into PostgreSQL via `scripts/import_interactions.py` or populate the `interactions.interactions` table.

---

### 🏛️ Dataset Type 2: Point of Interest (POI) & Venue Catalog
* **Role in Pipeline**: Powers geospatial candidate retrieval, opening hours filtering (`time_suitability`), budget matching (`budget_suitability`), and Google Maps rendering.
* **Required Data Attributes & Schema (JSON / YAML / CSV)**:
  | Column Name | Data Type | Example Value | Description |
  | :--- | :--- | :--- | :--- |
  | `name` | String | `"Third Wave Coffee Roasters"` | Venue name |
  | `category` | String | `"cafe"` | `cafe`, `restaurant`, `bar`, `park`, `museum`, `cinema`, `attraction`, `shopping` |
  | `subcategory` | String | `"roastery"` | Specific subcategory or cuisine |
  | `lat`, `lng` | Float | `12.9716, 77.5946` | WGS84 GPS coordinates |
  | `city`, `state` | String | `"Bangalore", "Karnataka"` | City and state names in India |
  | `opening_hours` | JSON Dict | `{"mon": [["08:00", "23:00"]], ...}` | Weekday opening shifts (supports split shifts & overnight) |
  | `cost_for_two` | Float (INR) | `800.0` | Estimated meal or outing cost for two people |
  | `price_range` | Integer (0–4) | `2` | 0=Free, 1=Budget, 2=Moderate, 3=Upscale, 4=Luxury |
  | `indoor_outdoor`| String | `"indoor"`, `"outdoor"`, `"both"` | Used for real-time weather suitability adjustment |
  | `ambience` | List of Strings| `["cozy", "scenic", "quiet"]` | Content-based filtering matching tags |
  | `tags` | List of Strings| `["wifi", "rooftop", "pet_friendly"]`| Venue features and occasion affinities |
  | `group_flags` | Booleans | `couple_friendly: true, family_friendly: true` | Occasion and outing type matching |
* **Best Ready-to-Fetch Public Sources**:
  1. **OpenStreetMap (OSM) via Overpass Turbo / API**: 100% free, no API key required. Query `amenity=restaurant|cafe|bar`, `tourism=attraction|museum`, `leisure=park` across India. Returns GPS coordinates, names, and OSM `opening_hours` tags (which our `parse_osm_opening_hours()` function parses out of the box).
  2. **Google Places API / Google Maps Bulk Extraction**: Using Place Search / Place Details to pull real opening hours, price levels, and ratings for Indian metro venues.
  3. **Kaggle "Indian Tourism Attractions" & "Zomato Bangalore Restaurants"**: Pre-curated CSV files containing rich dining and tourist attraction attributes for major Indian cities.
* **Easy Ingestion Method**: Append rows to `data/places_catalog.yaml` and run `scripts/sync_database_places.py` or `scripts/import_places.py`.

---

### 💬 Dataset Type 3: Review Text & Sentiment Dataset
* **Role in Pipeline**: Replaces the synthetic keyword lexicon in `sentiment-worker` with genuine NLP polarity and atmosphere extraction.
* **Required Data Attributes & Schema**:
  | Column Name | Data Type | Example Value | Description |
  | :--- | :--- | :--- | :--- |
  | `place_id` | Integer | `45` | Foreign key to venue catalog |
  | `review_text` | Text | `"Loved the sunset view from the terrace..."` | Customer review snippet |
  | `rating` | Float | `5.0` | Review star rating |
  | `sentiment_score` | Float (0.0–1.0) | `0.92` | Model-scored positive sentiment polarity |
* **Best Ready-to-Fetch Sources**:
  1. **Zomato Customer Reviews Dataset (Kaggle)**: India-centric dining review text with restaurant ratings.
  2. **Yelp Academic Reviews (`review.json`)**: Extensive English reviews across all leisure categories.
  3. **TripAdvisor Attractions Dataset**: Tourism and leisure reviews focusing on atmosphere and experiences.
* **Easy Ingestion Method**: Store in a `places.reviews` table or JSON file and run batch inference via HuggingFace `pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")`.

---

## 📋 4. Exhaustive Inventory of Tasks YET To Be Done

The following tasks represent the exact functional scope remaining to achieve a feature-complete system. *(Note: Deployment, cloud hosting, and SSL tasks have been intentionally excluded for now).*

### 🧠 Domain A: Algorithm & Machine Learning Enhancements

1. [ ] **Live Collaborative Filtering (CF) Ingestion in Recommendation Engine**
   - **Current State**: `cf_scores()` exists in `services/recommendation-engine/app/scoring.py`, but in `app/main.py` lines 200 and 223, `cf_score` and `"collaborative"` are hardcoded to `0.0`.
   - **Task**:
     - Connect `recommendation-engine` to query `interaction-service/interactions` to build the real item co-occurrence overlap matrix.
     - Pass the computed `cf_score` into `build_feature_vector()` and `fuse_candidate()`.
     - Activate the `existing_user` weight profile when positive interactions exceed the cold-start threshold ($N \ge 3$).

2. [ ] **Matrix Factorization / Implicit Alternating Least Squares (iALS)**
   - **Current State**: Item co-occurrence overlap is a heuristic Jaccard-like overlap.
   - **Task**:
     - Implement Matrix Factorization (TruncatedSVD / LightFM / iALS) over the sparse user-item interaction matrix.
     - Generate dense $k$-dimensional latent embeddings for users and places to support cross-category serendipitous discovery.

3. [ ] **Sequence Optimization for Itineraries (Travelling Salesperson Problem / 2-Opt Solver)**
   - **Current State**: `services/itinerary-service/app/planner.py` uses greedy nearest neighbor (`order_nearest_neighbour`), which can cause crossing paths or sub-optimal driving sequences.
   - **Task**:
     - Implement a 2-Opt TSP route heuristic in `order_nearest_neighbour` to minimize total travel time between morning, afternoon, evening, and night stops.
     - Eliminate crisscrossing stop sequences for 3–6 venue itineraries.

4. [ ] **Context-Aware Dynamic Weather & Temperature Weighting**
   - **Current State**: `weather_suitability` in `scoring.py` only checks `condition == "rain"`.
   - **Task**:
     - Incorporate temperature extremes from Open-Meteo (`temp_c > 38°C` heat wave or `temp_c < 5°C` cold) to penalize outdoor venues and favor air-conditioned/heated indoor spaces.
     - Adjust time-of-day weighting dynamically (e.g., recommend rooftop lounges during evening golden hour, indoor cafes during peak afternoon heat).

5. [ ] **Production NLP Transformer for Sentiment Worker**
   - **Current State**: `services/sentiment-worker/worker.py` generates synthetic snippets and scores them against a static positive/negative keyword dictionary.
   - **Task**:
     - Replace the keyword dictionary with a quantized local transformer (e.g. `cardiffnlp/twitter-roberta-base-sentiment-latest` or `distilbert-base-uncased-finetuned-sst-2-english`).
     - Ingest real customer review text (20–50 reviews per venue) to compute authentic sentiment polarity and extract key atmosphere adjectives.

---

### 🎨 Domain B: Frontend & User Experience

6. [ ] **Interactive Preference & Weight Sliders in Recommendations UI**
   - **Current State**: `RecommendPanel.tsx` offers static category/radius/budget filters without priority controls.
   - **Task**:
     - Add interactive sliders (0–100%) in `RecommendPanel.tsx` for core user priorities: Distance, Price, AI Match, and Popularity.
     - Expose `weight_overrides` in `RecommendRequest` and invoke `scoring.merge_weight_overrides()` on the backend.

7. [ ] **Dynamic Multi-Persona Group Outing Planner**
   - **Current State**: `frontend/components/GroupPlanner.tsx` displays hardcoded mock personas and a simulated 1.4s `setTimeout`.
   - **Task**:
     - Allow users to select multiple registered workspace profiles or input custom preferences per friend.
     - Wire the UI to trigger the group aggregation endpoint using consensus strategies (`least_misery`, `average`, `borda`).
     - Display individual persona satisfaction badges alongside the group itinerary.

8. [ ] **Live Dashboard Feeds & Activity Logs**
   - **Current State**: `frontend/app/dashboard/activity/page.tsx` renders a static `EVENTS` array, and `DashboardHome` uses static `DEMO_PLACES`.
   - **Task**:
     - Connect `ActivityPage` to `apiFetch("interactions/users/{id}/interactions")` to show real chronological user likes, skips, and itinerary generations.
     - Connect `DashboardHome` to fetch real top-ranked recommendations for the active user session.

9. [ ] **Interactive Itinerary Stop Swapping & Drag-and-Drop Reordering**
   - **Current State**: Date planner generates fixed itineraries with alternative backup suggestions in text.
   - **Task**:
     - Add a "Swap Stop" button next to each itinerary item to substitute with backup venues.
     - Implement drag-and-drop stop reordering with immediate recalculation of route polylines on the Google Map.

---

### 🔌 Domain C: Backend Microservices & Data Integration

10. [ ] **Live User Profile Ingestion in Recommendation Engine**
    - **Current State**: `services/recommendation-engine/app/main.py` line 190 sets `user_dict = {"budget_min": 0, "budget_max": 4}`.
    - **Task**:
      - Query `USER_SERVICE_URL/users/{user_id}` when `user_id` is supplied in `RecommendRequest`.
      - Inject the user's actual `budget_min`, `budget_max`, `preferred_categories`, `ambience_preferences`, and `home_lat/home_lng` into the scoring pipeline.

11. [ ] **Group Recommendation API Endpoint**
    - **Current State**: `scoring.aggregate_group_scores()` is implemented, but no REST endpoint in `recommendation-engine` accepts a list of user IDs for group scoring.
    - **Task**:
      - Add `POST /recommendations/group` accepting `{ user_ids: [1, 2, 3], strategy: "least_misery", ... }`.
      - Score candidates independently across all users and aggregate using the selected consensus method.

12. [ ] **Urban Travel Time & Road Routing Integration**
    - **Current State**: Distance calculations use straight-line Haversine formulas.
    - **Task**:
      - Integrate an Open Source Routing Machine (OSRM) local container (`osrm-backend`) or Google Distance Matrix API for accurate traffic-aware drive times between consecutive itinerary stops.

13. [ ] **POI Venue Catalog Expansion (Pan-India Scale)**
    - **Current State**: 310 curated venues across 93 cities (~3.3 places/city).
    - **Task**:
      - Execute OSM Overpass / Places extraction scripts to scale the catalog to 30–100 venues per tier-1/tier-2 city (target: 3,000–5,000 total places).

---

### 📊 Domain D: Offline Evaluation & Benchmarking

14. [ ] **Offline Evaluation Harness on Real Interaction Logs**
    - **Current State**: `scripts/evaluate.py` runs an ablation study over synthetic data only; `evaluation/` directory is empty.
    - **Task**:
      - Adapt `scripts/evaluate.py` to evaluate ranking quality over PostgreSQL interaction logs.
      - Compute Precision@K, Recall@K, NDCG@K, MAP@K, and intra-list diversity across 5-fold cross-validation.
      - Run full ablation tests zeroing out individual features to prove each component's incremental value.

---

### 🧪 Domain E: Testing & Code Quality

15. [ ] **Continuous Integration (CI) Workflow**
    - **Current State**: Tests are run manually on local developer machines.
    - **Task**:
      - Add `.github/workflows/ci.yml` running all 14 service unit tests and Next.js production build check on every pull request and push to `main` and `hemanth-dev`.
