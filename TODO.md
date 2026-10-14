# Project Roadmap & Pending Tasks (TODO)

This document contains **strictly the remaining tasks yet to be completed** to bring the **Outing Recommender Platform** to full production readiness (excluding hosting/deployment infrastructure for now).

> ℹ️ **Looking for completed tasks?**
> All verified deliverables, architectural completions, and closed milestones have been moved to [**`DONE.md`**](./DONE.md).

---

## ⏳ 1. Pending Deliverables Dashboard

| Subsystem / Layer | Priority | Milestone Status | Goal Description |
| :--- | :---: | :---: | :--- |
| **NLP Transformer Sentiment Worker** | Medium | **NOT DONE** (In Progress) | Replace keyword dictionary in `sentiment-worker` with quantized local transformer (`distilbert`) and real review inference |
| **POI Venue Catalog Expansion** | Medium | **NOT DONE** (Pending) | Overpass / Places scripts scaling catalog to 3,000–5,000 venues across India metro cities |

---

## 📊 2. Required Datasets for Remaining Tasks

The following specific dataset types are required to complete the remaining tasks (review NLP sentiment polarity and venue catalog expansion):

### 🏛️ Dataset Type 1: Point of Interest (POI) & Venue Catalog
* **Role in Pipeline**: Powers pan-India catalog expansion (Task 2), opening hours filtering, budget matching, and Google Maps rendering.
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
  1. **OpenStreetMap (OSM) via Overpass Turbo / API**: 100% free, no API key required. Query `amenity=restaurant|cafe|bar`, `tourism=attraction|museum`, `leisure=park` across India. Returns GPS coordinates, names, and OSM `opening_hours` tags.
  2. **Google Places API / Google Maps Bulk Extraction**: Using Place Search / Place Details to pull real opening hours, price levels, and ratings for Indian metro venues.
  3. **Kaggle "Indian Tourism Attractions" & "Zomato Bangalore Restaurants"**: Pre-curated CSV files containing rich dining and tourist attraction attributes for major Indian cities.
* **Easy Ingestion Method**: Append rows to `data/places_catalog.yaml` and run `scripts/sync_database_places.py` or `scripts/import_places.py`.

---

### 💬 Dataset Type 2: Review Text & Sentiment Dataset
* **Role in Pipeline**: Replaces the synthetic keyword lexicon in `sentiment-worker` (Task 1) with genuine NLP polarity and atmosphere extraction.
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

## 📋 3. Active Tasks To Be Done

The following 2 tasks represent strictly the remaining functional scope to achieve a feature-complete system. *(Note: Cloud hosting and production domain/SSL deployment have been intentionally excluded for now).*

### 🧠 Domain A: Algorithm & Machine Learning Enhancements

#### Task 1: Production NLP Transformer for Sentiment Worker
* **Status**: **NOT DONE** (In Progress)
* **Current State**: `services/sentiment-worker/worker.py` generates synthetic snippets and scores them against a static positive/negative keyword dictionary.
* **How To Complete It (Step-by-Step Guide)**:
  1. **Load HuggingFace Pipeline**:
     In [`services/sentiment-worker/worker.py`](./services/sentiment-worker/worker.py), initialize the transformer pipeline at worker startup:
     ```python
     from transformers import pipeline
     nlp = pipeline("sentiment-analysis", model="distilbert/distilbert-base-uncased-finetuned-sst-2-english")
     ```
  2. **Process Review Batches**:
     Pass review text batches through `nlp(reviews)`. Convert the output (`POSITIVE`/`NEGATIVE` label and probability score) into a continuous polarity score between $0.0$ and $1.0$:
     ```python
     polarity = score if label == "POSITIVE" else (1.0 - score)
     ```
  3. **Extract Atmosphere Adjectives**:
     Parse review text for atmospheric keywords (e.g., `cozy`, `romantic`, `scenic`, `lively`, `chill`, `rooftop`, `aesthetic`) to populate and update the venue's `ambience` tag list.
  4. **Persist Results**:
     Write the aggregated `sentiment_score` and updated `ambience` tags to the PostgreSQL `places` table or publish an event to RabbitMQ (`topic: sentiment.updated`).
  5. **Offline Fallback**:
     Wrap model loading in a `try...except` block so that if the model weights cannot be downloaded (e.g., air-gapped test environments), the service gracefully falls back to the existing keyword lexicon without crashing.

---

### 🏛️ Domain B: Catalog & Scale

#### Task 2: POI Venue Catalog Expansion (Pan-India Scale)
* **Status**: **NOT DONE** (Pending)
* **Current State**: 310 curated venues across 93 cities (~3.3 places/city).
* **How To Complete It (Step-by-Step Guide)**:
  1. **Execute OSM Overpass Extraction**:
     Use the OpenStreetMap Overpass Turbo API to query leisure and dining venues across top Indian metro and Tier-2 cities (Bangalore, Mumbai, Delhi-NCR, Hyderabad, Chennai, Kolkata, Pune, Jaipur, Goa, Ahmedabad, Kochi).
     Target OSM tags:
     - `amenity=restaurant|cafe|bar|pub`
     - `tourism=attraction|museum|viewpoint|gallery`
     - `leisure=park|garden`
  2. **Parse & Normalize Metadata**:
     Extract venue name, latitude, longitude, city, state, and opening hours tags. Synthesize realistic `cost_for_two` and `price_range` based on category heuristics (e.g., street food/cafes = 1–2, fine dining/lounges = 3–4).
  3. **Categorize Indoor vs. Outdoor**:
     Assign `indoor_outdoor` flags (`outdoor` for parks, viewpoints, and gardens; `indoor` for cafes, museums, and cinema; `both` for rooftop dining).
  4. **Append to YAML Catalog**:
     Append formatted YAML records to [`data/places_catalog.yaml`](./data/places_catalog.yaml) to scale the total catalog from 310 up to 3,000–5,000 places.
  5. **Sync with PostgreSQL**:
     Run the synchronization script to upsert the newly harvested places into the database:
     ```bash
     python scripts/sync_database_places.py
     ```
