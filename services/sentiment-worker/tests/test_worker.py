from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).resolve().parents[3]
WORKER_DIR = ROOT / "services" / "sentiment-worker"
SHARED_DIR = ROOT / "shared"

for p in (str(SHARED_DIR), str(WORKER_DIR)):
    if p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

import worker


def setup_function():
    worker._reset_model_cache()
    worker.set_default_review_source(None)


def test_polarity_conversion():
    assert worker.convert_label_to_polarity("POSITIVE", 0.95) == pytest.approx(0.95)
    assert worker.convert_label_to_polarity("positive", 0.8) == pytest.approx(0.8)
    assert worker.convert_label_to_polarity("NEGATIVE", 0.9) == pytest.approx(0.1)
    assert worker.convert_label_to_polarity("negative", 0.75) == pytest.approx(0.25)


def test_lexicon_scoring():
    pos_text = "The food was amazing, delicious and the staff was very friendly."
    assert worker.score_text(pos_text) == 1.0

    neg_text = "The service was slow, rude, dirty and overpriced."
    assert worker.score_text(neg_text) == 0.0

    neutral_text = "We walked into the store at noon."
    assert worker.score_text(neutral_text) == 0.5

    mixed_text = "The place was clean and lovely, but very noisy and overpriced."
    # 2 positive (clean, lovely), 2 negative (noisy, overpriced) -> 2/4 = 0.5
    assert worker.score_text(mixed_text) == 0.5


def test_score_reviews_lexicon():
    reviews = [
        "Great and delicious spot!",
        "Dirty and disappointing experience.",
    ]
    # first: 1.0, second: 0.0 -> average 0.5
    assert worker.score_reviews_lexicon(reviews) == 0.5
    assert worker.score_reviews_lexicon([]) == 0.5


def test_transformer_scoring_batching():
    mock_pipe = MagicMock()
    # 3 reviews: 2 positive, 1 negative
    mock_pipe.return_value = [
        {"label": "POSITIVE", "score": 0.9},
        {"label": "POSITIVE", "score": 0.8},
    ]

    reviews = ["Review 1", "Review 2"]
    score = worker.score_reviews_transformer(reviews, mock_pipe, batch_size=2)
    assert score == pytest.approx(0.85, abs=0.01)
    mock_pipe.assert_called_once()


def test_score_reviews_fallback_to_lexicon():
    with patch.dict(os.environ, {"SENTIMENT_BACKEND": "lexicon"}):
        reviews = ["Great delicious food!"]
        score = worker.score_reviews(reviews)
        assert score == 1.0


def test_extract_ambience_threshold_and_capping():
    reviews = [
        "Such a cozy and romantic candlelight dinner on the rooftop.",
        "Very cozy atmosphere and lovely romantic vibe.",
        "A quiet, scenic viewpoint with cozy seating.",
    ]
    curated = ["heritage"]
    merged, added = worker.extract_ambience(
        reviews,
        existing_ambience=curated,
        min_reviews=2,
    )

    # 'cozy' appears 3 times (>=2) -> added
    # 'romantic' appears 2 times (>=2) -> added
    # 'scenic', 'quiet', 'rooftop' appear 1 time (<2) -> omitted
    assert "heritage" in merged
    assert "cozy" in merged
    assert "romantic" in merged
    assert "scenic" not in merged
    assert set(added) == {"cozy", "romantic"}

    # Never exceeds 8 tags
    long_curated = ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
    merged_capped, added_capped = worker.extract_ambience(reviews, existing_ambience=long_curated)
    assert len(merged_capped) <= 8
    assert added_capped == []


def test_file_review_source_csv(tmp_path):
    csv_file = tmp_path / "reviews.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["place_id", "review_text", "rating"])
        writer.writeheader()
        writer.writerow({"place_id": "42", "review_text": "Incredible ambience and coffee", "rating": "5"})
        writer.writerow({"place_id": "42", "review_text": "Loved the rooftop sunset", "rating": "5"})
        writer.writerow({"place_id": "99", "review_text": "Not worth the wait", "rating": "2"})

    source = worker.FileReviewSource(filepath=str(csv_file))
    reviews_42 = source.get_reviews({"id": 42, "name": "Cafe Mocha"})
    assert len(reviews_42) == 2
    assert "Incredible ambience and coffee" in reviews_42

    reviews_unknown = source.get_reviews({"id": 100})
    assert reviews_unknown == []


def test_file_review_source_jsonl(tmp_path):
    jsonl_file = tmp_path / "reviews.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        f.write(json.dumps({"name": "Sky Bar", "city": "Bangalore", "review_text": "Stunning scenic view"}) + "\n")
        f.write(json.dumps({"name": "Sky Bar", "city": "Bangalore", "review_text": "Lively cocktails and music"}) + "\n")

    source = worker.FileReviewSource(filepath=str(jsonl_file))
    reviews = source.get_reviews({"id": 12, "name": "Sky Bar", "city": "Bangalore"})
    assert len(reviews) == 2
    assert any("Stunning" in r for r in reviews)


def test_composite_review_source_fallback_behavior():
    empty_primary = worker.FileReviewSource(filepath="", auto_discover=False)

    # With synthetic fallback DISABLED: returns empty list
    comp_no_fallback = worker.CompositeReviewSource(
        primary_source=empty_primary,
        enable_synthetic_fallback=False,
    )
    assert comp_no_fallback.get_reviews({"id": 1}) == []

    # With synthetic fallback ENABLED: generates synthetic reviews
    comp_fallback = worker.CompositeReviewSource(
        primary_source=empty_primary,
        enable_synthetic_fallback=True,
    )
    syn_reviews = comp_fallback.get_reviews({"id": 1})
    assert len(syn_reviews) == 5
    assert all(isinstance(r, str) for r in syn_reviews)


def test_analyze_place_honest_neutral():
    empty_source = worker.CompositeReviewSource(
        primary_source=worker.FileReviewSource(filepath="", auto_discover=False),
        enable_synthetic_fallback=False,
    )
    score, ambience_add = worker.analyze_place({"id": 500, "ambience": ["cozy"]}, review_source=empty_source)
    assert score == 0.5
    assert ambience_add == []


def test_update_place_sentiment_http_patch():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_client.patch.return_value = mock_response

    worker.update_place_sentiment(
        tenant_id="test-tenant",
        place_id=10,
        score=0.88,
        client=mock_client,
        ambience_add=["cozy", "romantic"],
    )

    mock_client.patch.assert_called_once()
    call_args = mock_client.patch.call_args
    assert "/places/10/sentiment" in call_args[0][0]
    assert call_args[1]["json"] == {"sentiment_score": 0.88, "ambience_add": ["cozy", "romantic"]}
    assert call_args[1]["headers"]["X-Tenant-Id"] == "test-tenant"
