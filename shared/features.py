"""
Shared feature vector builder so the XGBoost model trained by
model-training-worker and the model consumed by recommendation-engine
always agree on feature order.

Feature order (must stay stable across training + inference):
  0 distance_km            (0-50, lower is better)
  1 price_fit              (1.0 = within user's budget band, 0.0 = outside)
  2 cbf_score               (0-1 cosine similarity, category+ambience)
  3 cf_score                (0-1 collaborative co-occurrence signal)
  4 sentiment_score         (0-1)
  5 popularity_score        (0-1)
  6 is_weekend              (0/1)
  7 is_evening_or_night     (0/1)
  8 temp_c_norm             (temp_c / 40, clipped 0-1)
  9 is_rainy                (0/1)
"""

# Interaction strength weights (Review §11) - used for collaborative-filtering
# and popularity weighting once graduating past a plain binary label.
INTERACTION_WEIGHTS = {
    "view": 1, "click": 2, "save": 3, "share": 3, "visit": 5, "rating": 5, "skip": 0,
}
POSITIVE_INTERACTION_TYPES = {"save", "visit", "rating", "share"}

FEATURE_NAMES = [
    "distance_km", "price_fit", "cbf_score", "cf_score", "sentiment_score",
    "popularity_score", "is_weekend", "is_evening_or_night", "temp_c_norm", "is_rainy",
]


def build_feature_vector(place: dict, context: dict, user: dict,
                          cbf_score: float, cf_score: float) -> list:
    distance_km = min(place.get("distance_km", 25.0), 50.0)

    budget_min = user.get("budget_min", 0)
    budget_max = user.get("budget_max", 4)
    price = place.get("price_range", 2)
    price_fit = 1.0 if budget_min <= price <= budget_max else 0.0

    sentiment_score = place.get("sentiment_score", 0.5)
    popularity_score = place.get("popularity_score", 0.5)

    is_weekend = 1.0 if context.get("is_weekend") else 0.0
    time_of_day = context.get("time_of_day", "afternoon")
    is_evening_or_night = 1.0 if time_of_day in ("evening", "night") else 0.0

    weather = context.get("weather", {}) or {}
    temp_c = weather.get("temp_c")
    temp_c_norm = max(0.0, min((temp_c if temp_c is not None else 22) / 40.0, 1.0))
    is_rainy = 1.0 if weather.get("condition") == "rain" else 0.0

    return [
        distance_km, price_fit, cbf_score, cf_score, sentiment_score,
        popularity_score, is_weekend, is_evening_or_night, temp_c_norm, is_rainy,
    ]
