-- Migration 002 (for databases created before the auth/provenance work).
-- Idempotent. Run as the postgres superuser.
ALTER TABLE places.places
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE users.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS location_consent_at TIMESTAMPTZ;
ALTER TABLE itineraries.itineraries ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
-- NOTE: the api_key -> api_key_hash change and the new FK cascades are not
-- applied here because they require data backfill decisions; for the pre-beta
-- prototype, re-create the database from postgres/init/ instead.
