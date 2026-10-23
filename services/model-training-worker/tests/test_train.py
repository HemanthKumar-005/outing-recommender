"""
Unit tests for model-training-worker:
1. Label mapping and neutral row exclusion.
2. Leakage-free chronological feature engineering.
3. Fallback to synthetic dataset when real interactions are insufficient (<1,000 or single-class).
4. End-to-end model training on real interactions with temporal split and metadata generation.
"""
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
WORKER_DIR = ROOT / "services" / "model-training-worker"

for p in (str(SHARED_DIR), str(WORKER_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

import train  # type: ignore # noqa: E402
try:
    from shared.features import FEATURE_NAMES  # type: ignore # noqa: E402
except ImportError:
    from features import FEATURE_NAMES  # type: ignore # noqa: E402


class TestModelTrainingWorker(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.model_path = os.path.join(self.temp_dir.name, "xgboost_model.json")
        self.meta_path = os.path.join(self.temp_dir.name, "xgboost_model.meta.json")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_label_mapping(self):
        # Positive labels
        self.assertEqual(train.get_interaction_label("visit", None), 1)
        self.assertEqual(train.get_interaction_label("save", None), 1)
        self.assertEqual(train.get_interaction_label("share", None), 1)
        self.assertEqual(train.get_interaction_label("rating", 5.0), 1)
        self.assertEqual(train.get_interaction_label("rating", 4.0), 1)

        # Negative labels
        self.assertEqual(train.get_interaction_label("skip", None), 0)
        self.assertEqual(train.get_interaction_label("rating", 1.0), 0)
        self.assertEqual(train.get_interaction_label("rating", 2.0), 0)

        # Neutral / Ignored
        self.assertIsNone(train.get_interaction_label("view", None))
        self.assertIsNone(train.get_interaction_label("click", None))
        self.assertIsNone(train.get_interaction_label("rating", 3.0))
        self.assertIsNone(train.get_interaction_label("unknown", None))

        # Positive interaction boolean helper
        self.assertTrue(train.is_positive_interaction("visit", None))
        self.assertTrue(train.is_positive_interaction("rating", 4.5))
        self.assertFalse(train.is_positive_interaction("skip", None))
        self.assertFalse(train.is_positive_interaction("rating", 3.0))
        self.assertFalse(train.is_positive_interaction("view", None))

    def test_leakage_free_sequential_features(self):
        """
        Verify that features for interaction at t1 only see history BEFORE t1,
        and interaction at t2 sees history accumulated up to t1.
        """
        base_time = datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc)
        rows = [
            # Event 1: User 10 saves Place 100 -> label=1
            {
                "user_id": 10,
                "place_id": 100,
                "type": "save",
                "rating": None,
                "ts": base_time,
                "place_category": "cafe",
                "place_price_range": 2,
                "place_rating": 4.5,
                "place_lat": 12.9716,
                "place_lng": 77.5946,
                "place_ambience": ["cozy"],
                "place_sentiment_score": 0.8,
                "place_base_popularity": 0.5,
                "user_budget_min": 1,
                "user_budget_max": 3,
                "user_preferred_categories": ["cafe"],
                "user_ambience_preferences": ["cozy"],
                "user_preferred_distance_km": 10.0,
                "user_home_lat": 12.9716,
                "user_home_lng": 77.5946,
                "interaction_context": {"is_weekend": False, "time_of_day": "morning"},
            },
            # Event 2: User 20 visits Place 100 -> label=1 (t2 = t1 + 1 hour)
            {
                "user_id": 20,
                "place_id": 100,
                "type": "visit",
                "rating": None,
                "ts": base_time + timedelta(hours=1),
                "place_category": "cafe",
                "place_price_range": 2,
                "place_rating": 4.5,
                "place_lat": 12.9716,
                "place_lng": 77.5946,
                "place_ambience": ["cozy"],
                "place_sentiment_score": 0.8,
                "place_base_popularity": 0.5,
                "user_budget_min": 1,
                "user_budget_max": 3,
                "user_preferred_categories": ["cafe"],
                "user_ambience_preferences": ["cozy"],
                "user_preferred_distance_km": 10.0,
                "user_home_lat": 12.9716,
                "user_home_lng": 77.5946,
                "interaction_context": {"is_weekend": False, "time_of_day": "morning"},
            },
            # Event 3: User 10 skips Place 200 -> label=0 (t3 = t2 + 1 hour)
            {
                "user_id": 10,
                "place_id": 200,
                "type": "skip",
                "rating": None,
                "ts": base_time + timedelta(hours=2),
                "place_category": "bar",
                "place_price_range": 4,
                "place_rating": 3.0,
                "place_lat": 12.9716,
                "place_lng": 77.5946,
                "place_ambience": ["loud"],
                "place_sentiment_score": 0.4,
                "place_base_popularity": 0.3,
                "user_budget_min": 1,
                "user_budget_max": 3,
                "user_preferred_categories": ["cafe"],
                "user_ambience_preferences": ["cozy"],
                "user_preferred_distance_km": 10.0,
                "user_home_lat": 12.9716,
                "user_home_lng": 77.5946,
                "interaction_context": {"is_weekend": False, "time_of_day": "evening"},
            },
        ]

        X, y = train.build_dataset_from_interactions(rows)
        self.assertEqual(len(X), 3)
        self.assertEqual(len(y), 3)
        self.assertEqual(y.tolist(), [1, 1, 0])
        self.assertEqual(X.shape[1], len(FEATURE_NAMES))

        # At t1: Place 100 has 0 prior positive interactions -> popularity is base (0.5)
        # Feature index 5 is popularity_score
        pop_idx = FEATURE_NAMES.index("popularity_score")
        self.assertAlmostEqual(X[0, pop_idx], 0.5, places=2)

        # At t2: Place 100 had 1 prior positive interaction from User 10
        # popularity_score should now be strictly computed from prior interactions
        self.assertGreater(X[1, pop_idx], 0.0)

    def test_synthetic_fallback_when_insufficient_samples(self):
        """
        When real rows < MIN_REAL_SAMPLES (or single class), train() must fall back to synthetic.
        """
        sparse_rows = [
            {
                "user_id": 1,
                "place_id": 10,
                "type": "save",
                "rating": None,
                "ts": datetime.now(timezone.utc),
                "place_category": "cafe",
                "place_price_range": 2,
                "place_rating": 4.5,
                "place_lat": 12.0,
                "place_lng": 77.0,
                "place_ambience": ["cozy"],
                "place_sentiment_score": 0.5,
                "place_base_popularity": 0.5,
                "user_budget_min": 0,
                "user_budget_max": 4,
                "user_preferred_categories": ["cafe"],
                "user_ambience_preferences": ["cozy"],
                "user_preferred_distance_km": 10.0,
                "user_home_lat": 12.0,
                "user_home_lng": 77.0,
                "interaction_context": {},
            }
            for _ in range(5)  # only 5 rows, well below 1000 threshold
        ]

        with patch.object(train, "MODEL_PATH", self.model_path), \
             patch.object(train, "MODEL_METADATA_PATH", self.meta_path), \
             patch.object(train, "extract_interactions_from_db", return_value=sparse_rows), \
             patch.object(train, "N_SAMPLES", 500):

            model_path, metrics, dataset_version, training_mode = train.train()

            self.assertEqual(training_mode, "synthetic")
            self.assertTrue("synthetic" in dataset_version)
            self.assertTrue(os.path.isfile(model_path))
            self.assertIn("roc_auc", metrics)
            self.assertIn("val_samples", metrics)
            self.assertEqual(metrics["training_mode"], "synthetic")

    def test_training_on_real_interactions(self):
        """
        When real rows >= MIN_REAL_SAMPLES with both classes, train() trains on real data.
        """
        base_time = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
        simulated_rows = []
        for i in range(1200):
            t = base_time + timedelta(minutes=i * 10)
            is_pos = (i % 3 != 0)
            simulated_rows.append({
                "user_id": (i % 20) + 1,
                "place_id": (i % 50) + 1,
                "type": "save" if is_pos else "skip",
                "rating": 5.0 if is_pos else 1.0,
                "ts": t,
                "place_category": "cafe" if i % 2 == 0 else "restaurant",
                "place_price_range": (i % 4) + 1,
                "place_rating": 4.0 if is_pos else 2.5,
                "place_lat": 12.97 + (i % 10) * 0.01,
                "place_lng": 77.59 + (i % 10) * 0.01,
                "place_ambience": ["cozy"] if i % 2 == 0 else ["lively"],
                "place_sentiment_score": 0.8 if is_pos else 0.3,
                "place_base_popularity": 0.5,
                "user_budget_min": 1,
                "user_budget_max": 3,
                "user_preferred_categories": ["cafe"],
                "user_ambience_preferences": ["cozy"],
                "user_preferred_distance_km": 15.0,
                "user_home_lat": 12.97,
                "user_home_lng": 77.59,
                "interaction_context": {
                    "is_weekend": (t.weekday() >= 5),
                    "time_of_day": "evening" if t.hour >= 18 else "afternoon",
                    "weather": {"temp_c": 24.0, "condition": "clear"},
                },
            })

        with patch.object(train, "MODEL_PATH", self.model_path), \
             patch.object(train, "MODEL_METADATA_PATH", self.meta_path), \
             patch.object(train, "DATABASE_URL", "postgresql://trainer_role:x@localhost/db"), \
             patch.object(train, "extract_interactions_from_db", return_value=simulated_rows), \
             patch.object(train, "MIN_REAL_SAMPLES", 1000):

            model_path, metrics, dataset_version, training_mode = train.train()

            self.assertEqual(training_mode, "real_interactions")
            self.assertTrue(dataset_version.startswith("real_interactions_"))
            self.assertTrue(os.path.isfile(model_path))
            self.assertEqual(metrics["train_samples"], 960)  # 80% of 1200
            self.assertEqual(metrics["val_samples"], 240)    # 20% of 1200
            self.assertGreaterEqual(metrics["roc_auc"], 0.0)
            self.assertLessEqual(metrics["roc_auc"], 1.0)


if __name__ == "__main__":
    unittest.main()


class TestCredentialHandling(unittest.TestCase):
    def test_no_superuser_fallback_and_url_redaction(self):
        self.assertNotIn("postgres_admin_pw", open(train.__file__).read())
        self.assertEqual(
            train._redact("postgresql://trainer_role:s3cret@postgres:5432/outing"),
            "postgresql://trainer_role:***@postgres:5432/outing",
        )
