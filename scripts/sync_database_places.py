"""
Idempotent script to apply migrations and sync places from data/places_catalog.yaml
directly into the Postgres places.places table.
Can run against localhost (port 5432) or inside docker.
Upserts places: updates existing venues and inserts new venues for active tenants.
"""
from __future__ import annotations

import os
<<<<<<< HEAD
=======
import random
import sys
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
from pathlib import Path
import psycopg
from psycopg.types.json import Json
import yaml

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "places_catalog.yaml"
MIGRATION_PATH = ROOT / "postgres" / "migrations" / "001_add_hours_and_pricing.sql"

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "outing")
DB_USER = os.environ.get("DB_USER", "postgres")
<<<<<<< HEAD
DB_PASS = os.environ.get("DB_PASS", "")
if not DB_PASS:
    raise SystemExit("Set DB_PASS (the postgres superuser password from your .env) before running this script.")
=======
DB_PASS = os.environ.get("DB_PASS", "postgres_admin_pw")
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8


def sync_database():
    if not CATALOG_PATH.is_file():
        print(f"Catalog not found: {CATALOG_PATH}")
        return

    conn_str = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print(f"Connecting to Postgres at {DB_HOST}:{DB_PORT}/{DB_NAME}...")
    try:
        conn = psycopg.connect(conn_str, autocommit=True)
    except Exception as e:
        print(f"Cannot connect to database directly: {e}")
        print("If docker-compose is not running right now, run `docker-compose up -d postgres` first.")
        return

    cur = conn.cursor()

    # 1. Apply migration
    if MIGRATION_PATH.is_file():
        print("Applying migration 001_add_hours_and_pricing.sql...")
        with open(MIGRATION_PATH, "r", encoding="utf-8") as f:
            migration_sql = f.read()
        try:
            cur.execute(migration_sql)
            print("Migration applied successfully.")
        except Exception as e:
            print(f"Migration notice: {e}")

    # 2. Get active tenant IDs
    cur.execute("SELECT id FROM platform.tenants")
    tenant_rows = cur.fetchall()
    tenant_ids = [str(r[0]) for r in tenant_rows]
    if not tenant_ids:
        print("No tenants found in platform.tenants table.")
        cur.close()
        conn.close()
        return

    print(f"Found {len(tenant_ids)} active tenant(s): {tenant_ids}")

    # 3. Load catalog
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    places = data.get("places") or []
    print(f"Syncing {len(places)} places from catalog into database...")

    for tenant_id in tenant_ids:
        # Preload existing places for this tenant (by name and city)
        cur.execute(
            "SELECT name, city FROM places.places WHERE tenant_id = %s",
            (tenant_id,),
        )
        existing = {(r[0].strip().lower(), (r[1] or "").strip().lower()) for r in cur.fetchall()}

        updated_count = 0
        inserted_count = 0

        for p in places:
            p_name = p["name"].strip()
            p_city = (p.get("city") or "").strip()
            key = (p_name.lower(), p_city.lower())

            hours = p.get("opening_hours") or {}
            hours_src = p.get("opening_hours_source", "category_default")
            hours_est = p.get("opening_hours_is_estimated", True)
            entry_fee = float(p.get("entry_fee", 0.0))
            cost = float(p.get("cost_for_two") or p.get("average_cost") or 600.0)
            pricing_src = p.get("pricing_source", "category_default")
            pricing_est = p.get("pricing_is_estimated", True)
            price_range = int(p.get("price_range", 2))

            if key in existing:
                cur.execute(
                    """
                    UPDATE places.places
                    SET opening_hours = %s,
                        opening_hours_source = %s,
                        opening_hours_is_estimated = %s,
                        entry_fee = %s,
                        cost_for_two = %s,
                        pricing_source = %s,
                        pricing_is_estimated = %s,
<<<<<<< HEAD
                        price_range = %s,
                        source = %s
=======
                        price_range = %s
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                    WHERE tenant_id = %s AND LOWER(name) = %s AND LOWER(city) = %s
                    """,
                    (
                        Json(hours),
                        hours_src,
                        hours_est,
                        entry_fee,
                        cost,
                        pricing_src,
                        pricing_est,
                        price_range,
<<<<<<< HEAD
                        p.get("source", "repo_curated"),
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                        tenant_id,
                        p_name.lower(),
                        p_city.lower(),
                    ),
                )
                updated_count += cur.rowcount
            else:
<<<<<<< HEAD
                # Never invent ratings or review counts: unknown stays unknown.
                rating = None
                review_count = 0
=======
                rating = round(random.uniform(4.0, 4.9), 1)
                review_count = random.randint(45, 650)
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                cur.execute(
                    """
                    INSERT INTO places.places (
                        tenant_id, name, category, subcategory, price_range,
                        average_cost, cost_for_two, rating, review_count,
                        lat, lng, city, state, indoor_outdoor, ambience, tags,
                        description, family_friendly, couple_friendly, friends_friendly,
                        opening_hours, opening_hours_source, opening_hours_is_estimated,
                        entry_fee, pricing_source, pricing_is_estimated,
<<<<<<< HEAD
                        sentiment_score, popularity_score,
                        source, verification_status
=======
                        sentiment_score, popularity_score
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
<<<<<<< HEAD
                        %s, %s,
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                        %s, %s
                    )
                    """,
                    (
                        tenant_id,
                        p_name,
                        p.get("category", "restaurant"),
                        p.get("subcategory"),
                        price_range,
                        cost,
                        cost,
                        rating,
                        review_count,
                        float(p["lat"]),
                        float(p["lng"]),
                        p.get("city"),
                        p.get("state"),
                        p.get("indoor_outdoor", "indoor"),
                        Json(p.get("ambience") or []),
                        Json(p.get("tags") or []),
                        p.get("description", ""),
                        bool(p.get("family_friendly", True)),
                        bool(p.get("couple_friendly", True)),
                        bool(p.get("friends_friendly", True)),
                        Json(hours),
                        hours_src,
                        hours_est,
                        entry_fee,
                        pricing_src,
                        pricing_est,
                        0.5,
                        0.5,
<<<<<<< HEAD
                        p.get("source", "repo_curated"),
                        p.get("verification_status", "unverified"),
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                    ),
                )
                inserted_count += cur.rowcount
                existing.add(key)

        print(f"Tenant {tenant_id}: Updated {updated_count} existing, Inserted {inserted_count} new venues.")

    print("Database sync complete!")
    cur.close()
    conn.close()


if __name__ == "__main__":
    sync_database()
