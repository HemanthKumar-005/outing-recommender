"""
Unit tests for Recommendation Engine XGBoost model integration:
1. Model file missing (fallback to 0.5)
2. Feature names / version mismatch in metadata (rejection and fallback)
3. Successful hot-reload (thread-safe swap)
4. Failed reload (retains active model safely)
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import xgboost as xgb

ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
ENGINE_APP_DIR = ROOT / "services" / "recommendation-engine" / "app"

os.environ["ENABLE_XGBOOST_RANKER"] = "true"  # these tests exercise the (experimental) model path

for p in (str(SHARED_DIR), str(ENGINE_APP_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

try:
    from shared.features import FEATURE_NAMES, FEATURE_VERSION  # type: ignore # noqa: E402
except ImportError:
    from features import FEATURE_NAMES, FEATURE_VERSION  # type: ignore # noqa: E402
from model import ModelManager  # type: ignore # noqa: E402


class TestModelScoringIntegration(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.model_path = os.path.join(self.temp_dir.name, "xgboost_model.json")
        self.meta_path = os.path.join(self.temp_dir.name, "xgboost_model.meta.json")

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_valid_model(self, path: str, meta_path: str, version: str = "test_v1"):
        rng = np.random.default_rng(42)
        X = rng.uniform(0, 1, (20, len(FEATURE_NAMES)))
        y = rng.integers(0, 2, 20)
        dtrain = xgb.DMatrix(X, label=y, feature_names=FEATURE_NAMES)
        params = {"objective": "binary:logistic", "eval_metric": "auc", "max_depth": 2}
        booster = xgb.train(params, dtrain, num_boost_round=5)
        booster.save_model(path)

        metadata = {
            "model_name": "xgboost_recommender",
            "version": version,
            "feature_version": FEATURE_VERSION,
            "feature_names": FEATURE_NAMES,
            "metrics": {"roc_auc": 0.85},
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f)

    def test_model_missing_uses_fallback(self):
        mgr = ModelManager(model_path=self.model_path, metadata_path=self.meta_path)
        success = mgr.load()
        self.assertFalse(success)
        self.assertFalse(mgr.is_loaded)

        dummy_features = [[10.0, 1.0, 0.5, 0.0, 0.5, 0.5, 0.0, 0.0, 0.5, 0.0] for _ in range(5)]
        preds = mgr.predict_batch(dummy_features)
        self.assertEqual(len(preds), 5)
        self.assertEqual(preds, [0.5, 0.5, 0.5, 0.5, 0.5])

    def test_feature_mismatch_refuses_model(self):
        # 1. Mismatched feature names
        self._create_valid_model(self.model_path, self.meta_path)
        with open(self.meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        meta["feature_names"] = ["wrong_name_1", "wrong_name_2"]
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f)

        mgr = ModelManager(model_path=self.model_path, metadata_path=self.meta_path)
        self.assertFalse(mgr.load())
        self.assertFalse(mgr.is_loaded)

        dummy_features = [[0.0] * 10]
        self.assertEqual(mgr.predict_batch(dummy_features), [0.5])

        # 2. Mismatched feature version
        meta["feature_names"] = FEATURE_NAMES
        meta["feature_version"] = "v999_incompatible"
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f)

        mgr_v2 = ModelManager(model_path=self.model_path, metadata_path=self.meta_path)
        self.assertFalse(mgr_v2.load())
        self.assertFalse(mgr_v2.is_loaded)
        self.assertEqual(mgr_v2.predict_batch(dummy_features), [0.5])

    def test_successful_hot_reload(self):
        # Start without model
        mgr = ModelManager(model_path=self.model_path, metadata_path=self.meta_path)
        self.assertFalse(mgr.load())

        # Generate new model and send model.updated event
        self._create_valid_model(self.model_path, self.meta_path, version="20261010T120000Z")
        reloaded = mgr.reload_from_event(
            "model.updated",
            {"version": "20261010T120000Z", "path": self.model_path},
        )
        self.assertTrue(reloaded)
        self.assertTrue(mgr.is_loaded)
        self.assertEqual(mgr.metadata["version"], "20261010T120000Z")

        # Predictions should now come from XGBoost
        dummy_features = [[5.0, 1.0, 0.8, 0.5, 0.7, 0.9, 1.0, 0.0, 0.6, 0.0]]
        preds = mgr.predict_batch(dummy_features)
        self.assertEqual(len(preds), 1)
        self.assertIsInstance(preds[0], float)
        self.assertGreaterEqual(preds[0], 0.0)
        self.assertLessEqual(preds[0], 1.0)

    def test_failed_reload_preserves_old_model(self):
        # 1. Load valid model v1
        self._create_valid_model(self.model_path, self.meta_path, version="v1_initial")
        mgr = ModelManager(model_path=self.model_path, metadata_path=self.meta_path)
        self.assertTrue(mgr.load())
        self.assertTrue(mgr.is_loaded)
        self.assertEqual(mgr.metadata["version"], "v1_initial")

        preds_v1 = mgr.predict_batch([[1.0] * 10])

        # 2. Attempt reload with corrupted / incompatible payload
        corrupt_model_path = os.path.join(self.temp_dir.name, "bad_model.json")
        with open(corrupt_model_path, "w") as f:
            f.write("corrupted model bytes")
        corrupt_meta_path = os.path.join(self.temp_dir.name, "bad_model.meta.json")
        with open(corrupt_meta_path, "w") as f:
            json.dump({"feature_version": "invalid"}, f)

        reload_success = mgr.reload_from_event(
            "model.updated",
            {"path": corrupt_model_path},
        )
        self.assertFalse(reload_success)
        # Previous model must still be active and unchanged
        self.assertTrue(mgr.is_loaded)
        self.assertEqual(mgr.metadata["version"], "v1_initial")
        self.assertEqual(mgr.predict_batch([[1.0] * 10]), preds_v1)


if __name__ == "__main__":
    unittest.main()
