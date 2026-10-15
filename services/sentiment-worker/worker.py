"""
Sentiment worker for Outing Recommender.

Supports:
1. Production NLP Transformer (distilbert-base-uncased-finetuned-sst-2-english)
   loaded via lazy singleton with graceful offline fallback to a keyword lexicon.
2. ReviewSource abstraction:
   - FileReviewSource: reads real reviews (CSV/JSONL) with place_id or name+city matching.
   - SyntheticReviewSource: deterministic template generator used only as fallback.
   - Places with no reviews default to neutral 0.5 score unless synthetic fallback is enabled.
3. Ambience extraction:
   - Parses review text for atmospheric keywords matching canonical occasion and catalog tags.
   - Threshold filtering (minimum review count and minimum share).
   - Merges newly discovered ambience tags into existing curated tags (capped at 8, never removes curated).
4. Tenant-isolated persistence:
   - PATCHes place-service /places/{id}/sentiment carrying sentiment_score and optional ambience_add.
   - Places updated publish place.updated (reason: sentiment_updated) and sentiment.updated.
"""
from __future__ import annotations

import csv
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from typing import Any

if os.path.isdir("/shared") and "/shared" not in sys.path:
    sys.path.insert(0, "/shared")
for _p in Path(__file__).resolve().parents:
    if (_p / "shared").is_dir():
        _sp = str(_p / "shared")
        if _sp not in sys.path:
            sys.path.insert(0, _sp)
        break

try:
    from eventbus import consume  # noqa: E402
except ImportError:
    consume = None  # type: ignore

try:
    from pgdb_platform import list_tenant_ids  # noqa: E402
except ImportError:
    list_tenant_ids = lambda: []  # type: ignore # noqa: E731

try:
    from tenant import tenant_headers  # noqa: E402
except ImportError:
    tenant_headers = lambda tenant_id: {"X-Tenant-Id": str(tenant_id)}  # type: ignore # noqa: E731

import httpx  # noqa: E402

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")

# ---------------------------------------------------------------------------
# Lexicon scoring definitions
# ---------------------------------------------------------------------------
POSITIVE_WORDS = {
    "great", "amazing", "friendly", "cozy", "delicious", "clean", "lovely",
    "wonderful", "fantastic", "relaxing", "charming", "excellent", "fun", "beautiful",
}
NEGATIVE_WORDS = {
    "slow", "rude", "dirty", "overpriced", "noisy", "crowded", "disappointing",
    "bland", "cramped", "cold", "unfriendly", "mediocre",
}

TEMPLATES = [
    "The {adj1} staff made this {adj2} spot even better.",
    "A bit {adj_neg} but overall {adj1} experience.",
    "{adj1} atmosphere, would come back.",
    "Honestly {adj_neg} and {adj_neg2} for the price.",
    "{adj1} and {adj2}, perfect for a weekend visit.",
]

# ---------------------------------------------------------------------------
# Ambience extraction dictionary (maps keywords/variations to canonical tags)
# Compatible with configs/occasions.yaml and data/places_catalog.yaml
# ---------------------------------------------------------------------------
AMBIENCE_KEYWORD_MAP: dict[str, str] = {
    # Cozy
    "cozy": "cozy",
    "cosy": "cozy",
    "snug": "cozy",
    "homely": "cozy",
    "intimate": "cozy",
    # Romantic
    "romantic": "romantic",
    "romance": "romantic",
    "candlelight": "romantic",
    # Scenic & Viewpoint
    "scenic": "scenic",
    "viewpoint": "viewpoint",
    "panoramic": "scenic",
    "breathtaking": "scenic",
    "skyline": "scenic",
    "terrace": "scenic",
    # Lively
    "lively": "lively",
    "vibrant": "lively",
    "energetic": "lively",
    "buzzing": "lively",
    "bustling": "lively",
    # Chill & Casual
    "chill": "chill",
    "chilled": "chill",
    "relaxed": "chill",
    "relaxing": "chill",
    "casual": "casual",
    "laid-back": "casual",
    # Quiet
    "quiet": "quiet",
    "peaceful": "quiet",
    "serene": "quiet",
    "calm": "quiet",
    "tranquil": "quiet",
    # Rooftop
    "rooftop": "rooftop",
    "roof-top": "rooftop",
    # Aesthetic
    "aesthetic": "aesthetic",
    "instagrammable": "aesthetic",
    "photogenic": "aesthetic",
    "chic": "aesthetic",
    # Trendy
    "trendy": "trendy",
    "hip": "trendy",
    "modern": "trendy",
    # Outdoor & Nature
    "outdoor": "outdoor",
    "open-air": "outdoor",
    "garden": "outdoor",
    "nature": "nature",
    "greenery": "nature",
    # Heritage, Cultural, Artistic
    "heritage": "heritage",
    "historic": "heritage",
    "historical": "heritage",
    "cultural": "cultural",
    "culture": "cultural",
    "artistic": "artistic",
    "artsy": "artistic",
    # Adventure & Royal & Warm
    "adventure": "adventure",
    "royal": "royal",
    "majestic": "royal",
    "warm": "warm",
    "welcoming": "warm",
}

# ---------------------------------------------------------------------------
# Transformer model lazy singleton loader
# ---------------------------------------------------------------------------
_model_pipeline: Any | None = None
_model_load_attempted: bool = False
_model_load_failed: bool = False


def _reset_model_cache() -> None:
    """Reset model singleton state (used in unit tests)."""
    global _model_pipeline, _model_load_attempted, _model_load_failed
    _model_pipeline = None
    _model_load_attempted = False
    _model_load_failed = False


def convert_label_to_polarity(label: str, score: float) -> float:
    """
    Convert HuggingFace sentiment output to continuous 0.0-1.0 polarity:
    POSITIVE -> score
    NEGATIVE -> 1.0 - score
    """
    if str(label).strip().upper() == "POSITIVE":
        return float(score)
    return float(1.0 - score)


def get_transformer_pipeline() -> Any | None:
    """Lazy singleton loader for distilbert sentiment pipeline."""
    global _model_pipeline, _model_load_attempted, _model_load_failed
    backend = os.environ.get("SENTIMENT_BACKEND", "auto").strip().lower()
    if backend == "lexicon":
        return None
    if _model_pipeline is not None:
        return _model_pipeline
    if _model_load_failed:
        return None

    _model_load_attempted = True
    try:
        from transformers import pipeline  # type: ignore

        model_name = os.environ.get(
            "SENTIMENT_MODEL_NAME",
            "distilbert/distilbert-base-uncased-finetuned-sst-2-english",
        )
        _model_pipeline = pipeline("sentiment-analysis", model=model_name)
        print(f"[sentiment-worker] successfully loaded transformer model {model_name}")
        return _model_pipeline
    except Exception as e:
        _model_load_failed = True
        print(f"[sentiment-worker] failed to load transformer model, falling back to lexicon: {e}")
        return None


def score_text(text: str) -> float:
    """Keyword-based lexicon scoring (0.0 to 1.0)."""
    words = re.findall(r"\b\w+\b", text.lower())
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.5
    return pos / total


def score_reviews_lexicon(reviews: list[str]) -> float:
    """Score a collection of reviews using the keyword lexicon."""
    if not reviews:
        return 0.5
    scores = [score_text(r) for r in reviews]
    return round(sum(scores) / len(scores), 3)


def score_reviews_transformer(reviews: list[str], pipe: Any, batch_size: int = 16) -> float:
    """Score reviews in batches using a transformer sentiment pipeline."""
    if not reviews:
        return 0.5
    polarities: list[float] = []
    for i in range(0, len(reviews), batch_size):
        batch = reviews[i : i + batch_size]
        outputs = pipe(batch, truncation=True, max_length=256)
        for item in outputs:
            p = convert_label_to_polarity(item.get("label", ""), float(item.get("score", 0.5)))
            polarities.append(p)
    if not polarities:
        return 0.5
    return round(sum(polarities) / len(polarities), 3)


def score_reviews(reviews: list[str]) -> float:
    """Unified review scorer respecting SENTIMENT_BACKEND with automatic fallback."""
    if not reviews:
        return 0.5
    backend = os.environ.get("SENTIMENT_BACKEND", "auto").strip().lower()
    if backend != "lexicon":
        pipe = get_transformer_pipeline()
        if pipe is not None:
            try:
                batch_size = int(os.environ.get("BATCH_SIZE", os.environ.get("SENTIMENT_BATCH_SIZE", "16")))
                return score_reviews_transformer(reviews, pipe, batch_size=batch_size)
            except Exception as e:
                print(f"[sentiment-worker] transformer inference failed, falling back to lexicon: {e}")
    return score_reviews_lexicon(reviews)


# ---------------------------------------------------------------------------
# Ambience extraction
# ---------------------------------------------------------------------------
def extract_ambience(
    reviews: list[str],
    existing_ambience: list[str] | None = None,
    min_reviews: int | None = None,
    min_share: float | None = None,
) -> tuple[list[str], list[str]]:
    """
    Extracts ambience tags mentioned across reviews.
    Returns:
        (merged_ambience, ambience_add)
    Guarantees:
    - Never removes curated existing tags.
    - Caps total tags at 8.
    - Requires tag to appear in at least min_reviews or min_share of reviews.
    """
    if not reviews:
        curated = list(existing_ambience or [])
        return curated[:8], []

    if min_reviews is None:
        min_reviews = int(os.environ.get("AMBIENCE_MIN_REVIEWS", "2"))
    if min_share is None:
        min_share = float(os.environ.get("AMBIENCE_MIN_SHARE", "0.25"))

    tag_counts: dict[str, int] = {}
    for review in reviews:
        review_lower = review.lower()
        # Find all matching tags in this review (at most once per review)
        review_tags: set[str] = set()
        for kw, tag in AMBIENCE_KEYWORD_MAP.items():
            if re.search(r"\b" + re.escape(kw) + r"\b", review_lower):
                review_tags.add(tag)
        for tag in review_tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    total_reviews = len(reviews)
    qualifying_tags: list[str] = []
    for tag, count in tag_counts.items():
        if count >= min_reviews and (count / total_reviews) >= min_share:
            qualifying_tags.append(tag)

    # Deterministic alphabetical ordering for stability
    qualifying_tags.sort()

    curated = list(existing_ambience or [])
    merged = list(curated)
    for tag in qualifying_tags:
        if tag not in merged:
            merged.append(tag)

    # Cap at 8
    merged = merged[:8]
    ambience_add = [t for t in merged if t not in curated]
    return merged, ambience_add


# ---------------------------------------------------------------------------
# Review Sources abstraction
# ---------------------------------------------------------------------------
class ReviewSource:
    """Base interface for fetching reviews for a place."""

    def get_reviews(self, place: dict) -> list[str]:
        raise NotImplementedError


def _synthetic_reviews(place: dict, n: int = 5) -> list[str]:
    """Deterministic template-based synthetic review generator."""
    place_id = place.get("id", 1)
    rng = random.Random(place_id if isinstance(place_id, int) else 1)
    reviews = []
    for _ in range(n):
        template = rng.choice(TEMPLATES)
        review = template.format(
            adj1=rng.choice(list(POSITIVE_WORDS)),
            adj2=rng.choice(list(POSITIVE_WORDS)),
            adj_neg=rng.choice(list(NEGATIVE_WORDS)),
            adj_neg2=rng.choice(list(NEGATIVE_WORDS)),
        )
        reviews.append(review)
    return reviews


class SyntheticReviewSource(ReviewSource):
    """Fallback review generator using synthetic templates."""

    def get_reviews(self, place: dict) -> list[str]:
        print(f"[sentiment-worker] using synthetic review generator fallback for place {place.get('id')}")
        return _synthetic_reviews(place)


class FileReviewSource(ReviewSource):
    """
    Reads review records from a CSV or JSONL file at reviews_path.
    Matches either by place_id or by (place_name, city).
    """

    def __init__(self, filepath: str | Path | None = None, auto_discover: bool = True) -> None:
        if filepath is not None:
            self.filepath = filepath if str(filepath).strip() else None
        elif auto_discover:
            env_path = os.environ.get("REVIEWS_PATH")
            if env_path:
                self.filepath = env_path
            else:
                candidates = [
                    Path("/data/reviews.csv"),
                    Path(__file__).resolve().parents[2] / "data" / "reviews.csv",
                    Path("data/reviews.csv"),
                ]
                self.filepath = next((p for p in candidates if p.is_file()), None)
        else:
            self.filepath = None

        self.by_place_id: dict[int, list[str]] = {}
        self.by_name_city: dict[tuple[str, str], list[str]] = {}
        self._loaded = False
        if self.filepath:
            self._load()

    def _load(self) -> None:
        if not self.filepath:
            return
        path = Path(self.filepath)
        if not path.is_file():
            print(f"[sentiment-worker] reviews file not found at {self.filepath}")
            return

        try:
            if path.suffix.lower() == ".jsonl":
                with open(path, encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        row = json.loads(line)
                        self._index_row(row)
            else:
                # Default CSV
                with open(path, encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        self._index_row(row)
            self._loaded = True
            print(
                f"[sentiment-worker] loaded reviews from {self.filepath} "
                f"({len(self.by_place_id)} places by ID, {len(self.by_name_city)} by name/city)"
            )
        except Exception as e:
            print(f"[sentiment-worker] failed to load reviews from {self.filepath}: {e}")

    def _index_row(self, row: dict[str, Any]) -> None:
        text = str(row.get("review_text") or row.get("text") or row.get("review") or "").strip()
        if not text:
            return

        pid_val = row.get("place_id")
        if pid_val is not None and str(pid_val).strip():
            try:
                pid = int(pid_val)
                self.by_place_id.setdefault(pid, []).append(text)
            except ValueError:
                pass

        pname = str(row.get("place_name") or row.get("name") or "").strip().lower()
        city = str(row.get("city") or "").strip().lower()
        if pname:
            key = (pname, city)
            self.by_name_city.setdefault(key, []).append(text)

    def get_reviews(self, place: dict) -> list[str]:
        pid = place.get("id")
        if pid is not None and pid in self.by_place_id:
            return self.by_place_id[pid]

        pname = str(place.get("name") or "").strip().lower()
        city = str(place.get("city") or "").strip().lower()
        if pname:
            if (pname, city) in self.by_name_city:
                return self.by_name_city[(pname, city)]
            if (pname, "") in self.by_name_city:
                return self.by_name_city[(pname, "")]
        return []


class CompositeReviewSource(ReviewSource):
    """
    Tries primary review source (e.g. FileReviewSource) first.
    If no reviews are found:
      - Falls back to SyntheticReviewSource only if enable_synthetic_fallback is True.
      - Otherwise returns empty list (keeping score neutral 0.5 without inventing data).
    """

    def __init__(
        self,
        primary_source: ReviewSource | None = None,
        enable_synthetic_fallback: bool | None = None,
    ) -> None:
        self.primary_source = primary_source or FileReviewSource()
        if enable_synthetic_fallback is None:
            enable_synthetic_fallback = os.environ.get(
                "ENABLE_SYNTHETIC_FALLBACK", "false"
            ).lower() in ("true", "1", "yes")
        self.enable_synthetic_fallback = enable_synthetic_fallback
        self.synthetic_source = SyntheticReviewSource()

    def get_reviews(self, place: dict) -> list[str]:
        reviews = self.primary_source.get_reviews(place)
        if reviews:
            return reviews
        if self.enable_synthetic_fallback:
            return self.synthetic_source.get_reviews(place)
        return []


_default_review_source: ReviewSource | None = None


def get_default_review_source() -> ReviewSource:
    global _default_review_source
    if _default_review_source is None:
        _default_review_source = CompositeReviewSource()
    return _default_review_source


def set_default_review_source(source: ReviewSource | None) -> None:
    global _default_review_source
    _default_review_source = source


# ---------------------------------------------------------------------------
# High-level place analysis & persistence
# ---------------------------------------------------------------------------
def analyze_place(
    place: dict,
    review_source: ReviewSource | None = None,
) -> tuple[float, list[str]]:
    """
    Computes sentiment score and new ambience tags for a place.
    Returns:
        (sentiment_score, ambience_add)
    If no reviews exist and synthetic fallback is disabled:
        Returns (0.5, []) neutral score without fabricating data.
    """
    src = review_source or get_default_review_source()
    reviews = src.get_reviews(place)

    if not reviews:
        # Honest neutral score when no real reviews are available
        return 0.5, []

    score = score_reviews(reviews)
    existing_ambience = place.get("ambience")
    if not isinstance(existing_ambience, list):
        existing_ambience = []

    _, ambience_add = extract_ambience(reviews, existing_ambience=existing_ambience)
    return score, ambience_add


def score_place(place: dict, review_source: ReviewSource | None = None) -> float:
    """Backward-compatible helper returning solely the sentiment score."""
    score, _ = analyze_place(place, review_source=review_source)
    return score


def update_place_sentiment(
    tenant_id: str,
    place_id: int,
    score: float,
    client: httpx.Client,
    ambience_add: list[str] | None = None,
) -> None:
    """PATCHes place-service with sentiment score and optional ambience_add."""
    payload: dict[str, Any] = {"sentiment_score": score}
    if ambience_add:
        payload["ambience_add"] = ambience_add

    try:
        resp = client.patch(
            f"{PLACE_SERVICE_URL}/places/{place_id}/sentiment",
            json=payload,
            headers=tenant_headers(tenant_id),
        )
        resp.raise_for_status()
        print(f"[sentiment-worker] tenant={tenant_id} place {place_id} -> sentiment {score} ambience_add={ambience_add or []}")
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] failed to update tenant={tenant_id} place {place_id}: {e}")


def sweep_tenant(tenant_id: str, client: httpx.Client, review_source: ReviewSource | None = None) -> None:
    try:
        resp = client.get(f"{PLACE_SERVICE_URL}/places", headers=tenant_headers(tenant_id))
        resp.raise_for_status()
        places = resp.json()
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] startup sweep failed for tenant={tenant_id}: {e}")
        return
    for place in places:
        score, ambience_add = analyze_place(place, review_source=review_source)
        update_place_sentiment(tenant_id, place["id"], score, client, ambience_add=ambience_add)


def sweep_all_tenants(client: httpx.Client, review_source: ReviewSource | None = None) -> None:
    try:
        tenant_ids = list_tenant_ids()
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] could not list tenants for startup sweep: {e}")
        return
    for tenant_id in tenant_ids:
        sweep_tenant(tenant_id, client, review_source=review_source)


def main() -> None:
    client = httpx.Client(timeout=5.0)

    for attempt in range(10):
        try:
            client.get(f"{PLACE_SERVICE_URL}/health").raise_for_status()
            break
        except Exception:
            print(f"[sentiment-worker] waiting for place-service ({attempt + 1}/10)...")
            time.sleep(3)

    sweep_all_tenants(client)

    def on_message(routing_key: str, payload: dict) -> None:
        # Loop guard: ignore updates triggered by our own sentiment updates
        if routing_key == "place.updated" and payload.get("reason") != "sentiment_updated":
            tenant_id = payload.get("tenant_id")
            place_id = payload.get("place_id")
            if not tenant_id or not place_id:
                return
            try:
                resp = client.get(f"{PLACE_SERVICE_URL}/places/{place_id}", headers=tenant_headers(tenant_id))
                resp.raise_for_status()
                place = resp.json()
            except Exception as e:  # noqa: BLE001
                print(f"[sentiment-worker] could not fetch tenant={tenant_id} place {place_id}: {e}")
                return
            score, ambience_add = analyze_place(place)
            update_place_sentiment(tenant_id, place_id, score, client, ambience_add=ambience_add)

    if consume:
        consume("sentiment-worker.place-updates", ["place.updated"], on_message)


if __name__ == "__main__":
    main()
