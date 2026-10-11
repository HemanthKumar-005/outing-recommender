"""
Model manager for recommendation-engine.

Handles:
1. Thread-safe loading and hot-reloading of the XGBoost scoring model.
2. Metadata verification (feature_names and feature_version must match shared/features.py).
3. Batched inference over candidate feature vectors.
4. Graceful 0.5 fallback if model is missing, corrupt, or mismatched.
5. Background RabbitMQ listener for 'model.updated' topic with auto-reconnection.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
from pathlib import Path
from typing import Any

# Ensure /shared and root/shared are importable
ROOT = Path(__file__).resolve().parents[3]
SHARED_DIR = ROOT / "shared"
if str(SHARED_DIR) not in sys.path and SHARED_DIR.is_dir():
    sys.path.insert(0, str(SHARED_DIR))
if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")

try:
    from features import FEATURE_NAMES, FEATURE_VERSION
except ImportError:
    FEATURE_NAMES = [
        "distance_km", "price_fit", "cbf_score", "cf_score", "sentiment_score",
        "popularity_score", "is_weekend", "is_evening_or_night", "temp_c_norm", "is_rainy",
    ]
    FEATURE_VERSION = "v1"

logger = logging.getLogger("recommendation-engine.model")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

MODEL_PATH_DEFAULT = os.environ.get("MODEL_PATH", "/models/xgboost_model.json")
MODEL_METADATA_PATH_DEFAULT = os.environ.get("MODEL_METADATA_PATH", "/models/xgboost_model.meta.json")


class ModelManager:
    def __init__(
        self,
        model_path: str = MODEL_PATH_DEFAULT,
        metadata_path: str = MODEL_METADATA_PATH_DEFAULT,
    ):
        self.model_path = model_path
        self.metadata_path = metadata_path
        self._lock = threading.Lock()
        self._booster: Any | None = None
        self._metadata: dict[str, Any] | None = None
        self._listener_thread: threading.Thread | None = None

    @property
    def is_loaded(self) -> bool:
        with self._lock:
            return self._booster is not None

    @property
    def metadata(self) -> dict[str, Any] | None:
        with self._lock:
            return dict(self._metadata) if self._metadata else None

    def load(
        self,
        model_path: str | None = None,
        metadata_path: str | None = None,
    ) -> bool:
        """
        Load and validate model from disk.
        Returns True on success. On failure or missing files, logs warning and
        leaves booster as None (or preserves current booster if this is a reload).
        """
        target_model = model_path or self.model_path
        target_meta = metadata_path or self.metadata_path

        if not os.path.isfile(target_model):
            logger.warning(
                "[model] Model file '%s' not found. Using fallback ML score of 0.5.",
                target_model,
            )
            return False

        if not os.path.isfile(target_meta):
            logger.warning(
                "[model] Metadata file '%s' not found. Refusing to use unverified model. Using 0.5 fallback.",
                target_meta,
            )
            return False

        # 1. Parse and validate metadata
        try:
            with open(target_meta, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            logger.warning("[model] Failed to read metadata from '%s': %s. Using 0.5 fallback.", target_meta, e)
            return False

        meta_features = meta.get("feature_names")
        meta_version = meta.get("feature_version")

        if meta_features != FEATURE_NAMES or meta_version != FEATURE_VERSION:
            logger.warning(
                "[model] Feature schema mismatch in '%s'! Expected version='%s', names=%s. "
                "Found version='%s', names=%s. Refusing model, using fallback 0.5.",
                target_meta,
                FEATURE_VERSION,
                FEATURE_NAMES,
                meta_version,
                meta_features,
            )
            return False

        # 2. Parse booster
        try:
            import xgboost as xgb
            booster = xgb.Booster()
            booster.load_model(target_model)
        except Exception as e:
            logger.warning("[model] Failed to load XGBoost booster from '%s': %s. Using fallback.", target_model, e)
            return False

        # 3. Thread-safe atomic swap
        with self._lock:
            self._booster = booster
            self._metadata = meta
            self.model_path = target_model
            self.metadata_path = target_meta

        logger.info(
            "[model] Successfully loaded XGBoost model (version='%s', feature_version='%s') from '%s'",
            meta.get("version", "unknown"),
            meta_version,
            target_model,
        )
        return True

    def reload_from_event(self, routing_key: str, payload: dict) -> bool:
        """
        Callback when a 'model.updated' message is received.
        Loads into candidate structures first, validates, and only then swaps in.
        If loading fails, the old model remains active.
        """
        logger.info("[model] Received '%s' notification: %s", routing_key, payload)
        new_path = payload.get("path") or self.model_path
        # Look for companion meta file or default metadata path
        cand_meta = f"{new_path}.meta.json" if os.path.isfile(f"{new_path}.meta.json") else self.metadata_path
        if not os.path.isfile(cand_meta):
            base, _ = os.path.splitext(new_path)
            if os.path.isfile(f"{base}.meta.json"):
                cand_meta = f"{base}.meta.json"

        # Validate candidate model without disturbing existing active model
        if not os.path.isfile(new_path):
            logger.warning("[model] Reload aborted: file '%s' does not exist. Keeping existing model.", new_path)
            return False

        if not os.path.isfile(cand_meta):
            logger.warning("[model] Reload aborted: metadata '%s' missing. Keeping existing model.", cand_meta)
            return False

        try:
            with open(cand_meta, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            logger.warning("[model] Reload aborted: corrupt metadata '%s': %s. Keeping existing model.", cand_meta, e)
            return False

        if meta.get("feature_names") != FEATURE_NAMES or meta.get("feature_version") != FEATURE_VERSION:
            logger.warning(
                "[model] Reload aborted: schema mismatch in '%s'. Keeping existing model.",
                cand_meta,
            )
            return False

        try:
            import xgboost as xgb
            candidate_booster = xgb.Booster()
            candidate_booster.load_model(new_path)
        except Exception as e:
            logger.warning("[model] Reload aborted: cannot parse '%s': %s. Keeping existing model.", new_path, e)
            return False

        # Atomically swap
        with self._lock:
            self._booster = candidate_booster
            self._metadata = meta
            self.model_path = new_path
            self.metadata_path = cand_meta

        logger.info(
            "[model] Successfully hot-reloaded model (version='%s') from '%s'",
            meta.get("version", "unknown"),
            new_path,
        )
        return True

    def predict_batch(self, feature_rows: list[list[float]]) -> list[float]:
        """
        Batched prediction for candidate places.
        If model is None, returns 0.5 for all candidates.
        """
        if not feature_rows:
            return []

        with self._lock:
            booster = self._booster

        if booster is None:
            return [0.5] * len(feature_rows)

        try:
            import numpy as np
            import xgboost as xgb
            X = np.array(feature_rows, dtype=np.float32)
            dmatrix = xgb.DMatrix(X, feature_names=FEATURE_NAMES)
            preds = booster.predict(dmatrix)
            return [round(float(p), 4) for p in preds]
        except Exception as e:
            logger.warning("[model] Batched inference error: %s. Using 0.5 fallback.", e)
            return [0.5] * len(feature_rows)

    def start_listener(self) -> None:
        """
        Start background eventbus subscriber for 'model.updated'.
        Does not block and auto-retries on RabbitMQ downtime.
        """
        try:
            from eventbus import consume_in_background
            self._listener_thread = consume_in_background(
                queue_name="recommendation_engine_model_updates",
                routing_keys=["model.updated"],
                on_message=self.reload_from_event,
            )
            logger.info("[model] RabbitMQ listener started for 'model.updated'")
        except Exception as e:
            logger.warning(
                "[model] Could not start RabbitMQ event listener (%s). Engine will continue serving requests.",
                e,
            )


# Global singleton instance
model_manager = ModelManager()
