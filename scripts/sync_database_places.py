"""
Idempotent script to apply migrations and sync places from data/places_catalog.yaml
directly into the Postgres places.places table.
Can run against localhost (port 5432) or inside docker.
"""
from __future__ import annotations

import os
import sys
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
DB_PASS = os.environ.get("DB_PASS", "postgres_admin_pw")


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

    # 2. Load catalog
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    places = data.get("places") or []
    print(f"Syncing {len(places)} places from catalog into database...")

    updated_count = 0
    for p in places:
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
                price_range = %s
            WHERE name = %s
            """,
            (
                Json(p.get("opening_hours") or {}),
                p.get("opening_hours_source", "category_default"),
                p.get("opening_hours_is_estimated", True),
                p.get("entry_fee", 0.0),
                p.get("cost_for_two") or p.get("average_cost"),
                p.get("pricing_source", "category_default"),
                p.get("pricing_is_estimated", True),
                p.get("price_range", 2),
                p["name"],
            ),
        )
        if cur.rowcount > 0:
            updated_count += cur.rowcount

    print(f"Database sync complete! Updated {updated_count} place rows in places.places.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    sync_database()
