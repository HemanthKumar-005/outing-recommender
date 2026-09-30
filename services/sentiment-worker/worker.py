"""
Sentiment worker.

A production version would pull real review text (Google/Yelp APIs or a
reviews DB) and run it through a trained sentiment model. For a runnable
demo with no external review data, this worker generates a handful of
synthetic review snippets per place (seeded off the place's tags/category
so results are deterministic and plausible) and scores them with a small
positive/negative lexicon - no model download required, so it works
without network access.

Triggered by `place.updated` events on the bus (each payload carries the
tenant_id that owns the place); also does a full per-tenant sweep on
startup so freshly seeded catalogs get a sentiment score. The startup sweep
enumerates tenants via worker_role (read-only on platform.tenants, see
shared/pgdb_platform.py) and then calls place-service once per tenant with
that tenant's X-Tenant-Id header - no cross-tenant read ever happens.
"""
import os
import random
import sys
import time

import httpx

sys.path.insert(0, "/shared")
from eventbus import consume  # noqa: E402
from pgdb_platform import list_tenant_ids  # noqa: E402
from tenant import tenant_headers  # noqa: E402

PLACE_SERVICE_URL = os.environ.get("PLACE_SERVICE_URL", "http://place-service:8000")

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


def _synthetic_reviews(place: dict, n: int = 5) -> list:
    rng = random.Random(place["id"])
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


def score_text(text: str) -> float:
    words = text.lower().replace(".", "").replace(",", "").split()
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.5
    return pos / total


def score_place(place: dict) -> float:
    reviews = _synthetic_reviews(place)
    scores = [score_text(r) for r in reviews]
    return round(sum(scores) / len(scores), 3)


def update_place_sentiment(tenant_id: str, place_id: int, score: float, client: httpx.Client) -> None:
    try:
        resp = client.patch(
            f"{PLACE_SERVICE_URL}/places/{place_id}/sentiment",
            json={"sentiment_score": score}, headers=tenant_headers(tenant_id),
        )
        resp.raise_for_status()
        print(f"[sentiment-worker] tenant={tenant_id} place {place_id} -> sentiment {score}")
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] failed to update tenant={tenant_id} place {place_id}: {e}")


def sweep_tenant(tenant_id: str, client: httpx.Client) -> None:
    try:
        resp = client.get(f"{PLACE_SERVICE_URL}/places", headers=tenant_headers(tenant_id))
        resp.raise_for_status()
        places = resp.json()
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] startup sweep failed for tenant={tenant_id}: {e}")
        return
    for place in places:
        score = score_place(place)
        update_place_sentiment(tenant_id, place["id"], score, client)


def sweep_all_tenants(client: httpx.Client) -> None:
    try:
        tenant_ids = list_tenant_ids()
    except Exception as e:  # noqa: BLE001
        print(f"[sentiment-worker] could not list tenants for startup sweep: {e}")
        return
    for tenant_id in tenant_ids:
        sweep_tenant(tenant_id, client)


def main():
    client = httpx.Client(timeout=5.0)

    for attempt in range(10):
        try:
            client.get(f"{PLACE_SERVICE_URL}/health").raise_for_status()
            break
        except Exception:
            print(f"[sentiment-worker] waiting for place-service ({attempt + 1}/10)...")
            time.sleep(3)

    sweep_all_tenants(client)

    def on_message(routing_key: str, payload: dict):
        if routing_key == "place.updated" and payload.get("reason") != "sentiment_updated":
            tenant_id = payload.get("tenant_id")
            place_id = payload.get("place_id")
            if not tenant_id:
                return
            try:
                resp = client.get(f"{PLACE_SERVICE_URL}/places/{place_id}", headers=tenant_headers(tenant_id))
                resp.raise_for_status()
                place = resp.json()
            except Exception as e:  # noqa: BLE001
                print(f"[sentiment-worker] could not fetch tenant={tenant_id} place {place_id}: {e}")
                return
            score = score_place(place)
            update_place_sentiment(tenant_id, place_id, score, client)

    consume("sentiment-worker.place-updates", ["place.updated"], on_message)


if __name__ == "__main__":
    main()
