-- Migration: 001_add_hours_and_pricing.sql
-- Idempotent migration to add entry_fee, cost_for_two, and estimation metadata fields to places.places

ALTER TABLE places.places
    ADD COLUMN IF NOT EXISTS entry_fee REAL NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_for_two REAL,
    ADD COLUMN IF NOT EXISTS opening_hours_source TEXT NOT NULL DEFAULT 'category_default',
    ADD COLUMN IF NOT EXISTS opening_hours_is_estimated BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS pricing_source TEXT NOT NULL DEFAULT 'category_default',
    ADD COLUMN IF NOT EXISTS pricing_is_estimated BOOLEAN NOT NULL DEFAULT true;

-- Backfill cost_for_two from existing average_cost if cost_for_two is NULL
UPDATE places.places
SET cost_for_two = average_cost,
    pricing_source = 'repo_curated',
    pricing_is_estimated = false
WHERE cost_for_two IS NULL AND average_cost IS NOT NULL AND average_cost > 0;
