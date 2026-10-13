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
| **Algorithmic TSP Route Solver** | ✅ Completed | 4/4 passing | 2-opt TSP sequence heuristic in `itinerary-service` to minimize multi-stop driving time and eliminate crisscrossing |
| **Live Collaborative Filtering (CF)** | ✅ Completed | 6/6 passing | Co-occurrence overlap matrix queried live, wired into feature vector and candidate fusion with `existing_user` activation ($N \ge 3$) |
| **Context Weather & OpenWeatherMap** | ✅ Completed | Live API verified | OpenWeatherMap live API integration, temperature extremes ($\ge 38^\circ\text{C}$ / $\le 8^\circ\text{C}$) & evening golden hour dynamic scoring |
| **Dynamic Sliders & Group Consensus** | ✅ Completed | Verified | Interactive UI sliders for `weight_overrides`, `POST /recommendations/group` endpoint, `GroupPlanner.tsx` live consensus |
| **Live User Profile Ingestion** | ✅ Completed | Verified | Real user budget bounds, category and ambience preferences injected from `user-service` into recommendation pipeline |
| **Continuous Integration (CI) Workflow**| ✅ Completed | GitHub Actions | `.github/workflows/deploy-check.yml` running Docker validation, all 24 Python unit tests, and Next.js production build |
| **Live Dashboard Feeds & Activity Logs** | ⏳ Pending | Next milestone | Wire `ActivityPage` and `DashboardHome` to real chronological interaction and recommendation feeds |
| **Interactive Itinerary Stop Swapping** | ⏳ Pending | Next milestone | "Swap Stop" with backup venues and drag-and-drop reordering with live route recalculation |
| **Matrix Factorization (iALS)** | ⏳ Pending | Backlog | SVD / iALS latent embeddings over user-item interaction matrix for serendipitous discovery |
| **Urban Travel Time (OSRM Backend)** | ⏳ Pending | Backlog | OSRM / Google Distance Matrix container for traffic-aware travel times |
| **NLP Transformer Sentiment Worker** | ⏳ Pending | Backlog | Replace keyword dictionary in `sentiment-worker` with quantized local transformer |
| **POI Venue Catalog Expansion** | ⏳ Pending | Backlog | Overpass / Places scripts scaling catalog to 3,000–5,000 venues across India metro cities |
| **Offline Evaluation on Real Logs** | ⏳ Pending | Backlog | Precision@K, Recall@K, NDCG@K evaluation on PostgreSQL interaction logs |


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

### E. Itinerary Optimization & TSP Sequence Solver
- [x] **2-Opt Algorithmic TSP Route Solver**
  - Implemented `optimize_route_2opt()` and `total_route_distance()` in `services/itinerary-service/app/planner.py`.
  - Refined `order_nearest_neighbour()` to start with greedy nearest neighbour and iteratively reverse crossing edges using 2-opt swaps.
  - Minimizes travel distances and eliminates crisscrossing polygon routes for multi-stop outing plans (3–10 stops).
  - Unit tests verified: `services/itinerary-service/tests/test_planner.py` (4/4 passing).

### F. Collaborative Filtering & Live Context Dynamic Weather
- [x] **Live Collaborative Filtering (CF) & User Profile Ingestion**
  - Connected `services/recommendation-engine/app/main.py` to query `USER_SERVICE_URL/users/{user_id}` and `INTERACTION_SERVICE_URL/interactions`.
  - Computes live item co-occurrence overlap matrix via `scoring.cf_scores()` and user-to-place cosine similarity via `scoring.cbf_scores()`.
  - Injects user profile preferences (`budget_min`, `budget_max`, `preferred_categories`, `ambience_preferences`) and passes real CF and CBF scores to feature vector and candidate fusion.
  - Automatically activates the `existing_user` weight profile (CF weight 0.18) when positive interactions $N \ge 3$.
  - Unit tests verified: `services/recommendation-engine/tests/test_cf_and_weather.py` (6/6 passing).

- [x] **OpenWeatherMap Integration & Extreme Temperature Dynamic Scoring**
  - Configured verified OpenWeatherMap API key (`87032e0903bfff3247866dfa1b11b828`) in `.env`, `.env.example`, and `docker-compose.yml`.
  - Updated `services/context-service/app/main.py` with `_fetch_openweathermap()`, parsing live temperature, feels-like, humidity, wind, and conditions, with graceful fallback to Open-Meteo and mock weather.
  - Enhanced `scoring.weather_suitability()` in `recommendation-engine`:
    - Heatwave ($\ge 38^\circ\text{C}$): heavily penalizes outdoor venues ($0.15$), promotes air-conditioned indoor venues ($0.95$).
    - High heat ($33\text{--}38^\circ\text{C}$): penalizes outdoor venues in peak afternoon ($0.30$), favors indoor spaces.
    - Cold extremes ($< 8^\circ\text{C}$): penalizes outdoor venues ($0.25$), boosts cozy indoor spaces.
    - Evening golden hour: boosts rooftop lounges and scenic outdoor spaces ($0.95\text{--}1.0$).
  - Unit tests verified: `services/recommendation-engine/tests/test_cf_and_weather.py`.

### G. Group Consensus & Interactive Priority Sliders
- [x] **Group Recommendation API Endpoint (`/recommendations/group`)**
  - Added `POST /recommendations/group` and `POST /group` in `services/recommendation-engine/app/main.py` accepting `{ user_ids: [1, 2, ...], strategy: "least_misery" | "average" | "borda" }`.
  - Independently evaluates candidate places for each user profile, then aggregates scores via `scoring.aggregate_group_scores()`.
  - Returns ranked group places with per-user satisfaction breakdowns and lowest-satisfaction metrics.
- [x] **Interactive Priority Weight Sliders in UI**
  - Added interactive sliders ($0\text{--}100\%$) in `frontend/components/RecommendPanel.tsx` for Distance, AI Match, Budget/Context, and Popularity.
  - Dispatches `weight_overrides` payload to `RecommendRequest`, normalized and fused via `scoring.merge_weight_overrides()`.
- [x] **Multi-Persona Group Planner Integration**
  - Enhanced `frontend/components/GroupPlanner.tsx` with live group consensus API queries, persona selector toggles, and strategy pills (`Least Misery`, `Average`, `Borda Count`).

### H. Automated CI Workflow
- [x] **Continuous Integration Pipeline (`.github/workflows/deploy-check.yml`)**
  - Automated CI workflow executing Docker Compose configuration checks, YAML datasets validation, all 24 Python unit tests across microservices, and Next.js frontend production build on pull requests and pushes to `main` and `hemanth-dev`.


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

1. [x] **Live Collaborative Filtering (CF) Ingestion in Recommendation Engine**
   - **Completed**: Connected `services/recommendation-engine/app/main.py` to query `INTERACTION_SERVICE_URL/interactions` to compute live co-occurrence overlap matrix via `scoring.cf_scores()`. Injects user profile preferences (`budget_min`, `budget_max`, `preferred_categories`, `ambience_preferences`) and feeds real `cf_score` and `cbf_score` into `build_feature_vector()` and `fuse_candidate()`. Automatically activates `existing_user` weight profile ($CF=0.18$) when positive interactions $N \ge 3$.
   - **Unit Tests**: `services/recommendation-engine/tests/test_cf_and_weather.py` (6/6 passing).

2. [ ] **Matrix Factorization / Implicit Alternating Least Squares (iALS)**
   - **Current State**: Item co-occurrence overlap is a heuristic Jaccard-like overlap.
   - **Task**:
     - Implement Matrix Factorization (TruncatedSVD / LightFM / iALS) over the sparse user-item interaction matrix.
     - Generate dense $k$-dimensional latent embeddings for users and places to support cross-category serendipitous discovery.

3. [x] **Sequence Optimization for Itineraries (Travelling Salesperson Problem / 2-Opt Solver)**
   - **Completed**: Implemented 2-Opt TSP heuristic in `services/itinerary-service/app/planner.py` (`optimize_route_2opt()` & `total_route_distance()`). Initializes tour with nearest-neighbour and iteratively evaluates pairwise inversions to eliminate route crossings and minimize travel distance.
   - **Unit Tests**: `services/itinerary-service/tests/test_planner.py` (4/4 passing).

4. [x] **Context-Aware Dynamic Weather & Temperature Weighting (OpenWeatherMap)**
   - **Completed**: Integrated OpenWeatherMap live current weather API (`services/context-service/app/main.py`) with active key (`87032e0903bfff3247866dfa1b11b828`) and fallback to Open-Meteo & mock. Enhanced `scoring.weather_suitability()` to dynamically penalize outdoor venues during extreme heatwaves ($\ge 38^\circ\text{C}$), high afternoon heat ($33\text{--}38^\circ\text{C}$), cold ($< 8^\circ\text{C}$), and rain ($0.15$), while boosting AC indoor spots and rewarding rooftop/scenic outdoor venues during evening golden hours ($0.95\text{--}1.0$).
   - **Unit Tests**: `services/recommendation-engine/tests/test_cf_and_weather.py`.

5. [ ] **Production NLP Transformer for Sentiment Worker**
   - **Current State**: `services/sentiment-worker/worker.py` generates synthetic snippets and scores them against a static positive/negative keyword dictionary.
   - **Task**:
     - Replace the keyword dictionary with a quantized local transformer (e.g. `cardiffnlp/twitter-roberta-base-sentiment-latest` or `distilbert-base-uncased-finetuned-sst-2-english`).
     - Ingest real customer review text (20–50 reviews per venue) to compute authentic sentiment polarity and extract key atmosphere adjectives.

---

### 🎨 Domain B: Frontend & User Experience

6. [x] **Interactive Preference & Weight Sliders in Recommendations UI**
   - **Completed**: Added interactive priority weight sliders ($0\text{--}100\%$) in `frontend/components/RecommendPanel.tsx` for Distance, AI Match, Budget/Context, and Popularity. Sends `weight_overrides` payload in `RecommendRequest`, normalized and fused via `scoring.merge_weight_overrides()`.
   - **Build**: Next.js 14 verified cleanly compiling all routes.

7. [x] **Dynamic Multi-Persona Group Outing Planner**
   - **Completed**: Updated `frontend/components/GroupPlanner.tsx` with persona toggles, strategy selector pills (`Least Misery`, `Average`, `Borda Count`), and live API calls to `/api/recommendations/group`. Renders per-persona satisfaction badges and consensus match rankings.

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

10. [x] **Live User Profile Ingestion in Recommendation Engine**
    - **Completed**: `services/recommendation-engine/app/main.py` queries `USER_SERVICE_URL/users/{user_id}` and injects actual user profile parameters (`budget_min`, `budget_max`, `preferred_categories`, `ambience_preferences`, `home_lat`, `home_lng`) into the feature extraction and scoring pipeline.

11. [x] **Group Recommendation API Endpoint**
    - **Completed**: Implemented `POST /recommendations/group` and `POST /group` in `services/recommendation-engine/app/main.py`. Evaluates candidate POIs across each user profile and aggregates using consensus strategies (`least_misery`, `average`, `borda`) via `scoring.aggregate_group_scores()`. Returns ranked recommendations with per-user scores and lowest-satisfaction indicators.

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

15. [x] **Continuous Integration (CI) Workflow**
    - **Completed**: Updated `.github/workflows/deploy-check.yml` to include the automated `test-services` job running all 24 pytest unit tests across all microservices alongside Docker Compose configuration checks and Next.js production build verification on all pull requests and pushes to `main` and `hemanth-dev`.

