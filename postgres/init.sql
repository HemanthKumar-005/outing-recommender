-- Runs once, automatically, when the postgres container's data directory is
-- empty (docker-entrypoint-initdb.d convention). This is the source of truth
-- for the multi-tenant + RLS design: one Postgres database ("outing"), one
-- schema per service, every tenant-owned table isolated by a row-level
-- security policy on tenant_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Roles
--   app_role      - used by every tenant-scoped service (user/place/
--                   interaction/notification/itinerary). CRUD on its
--                   service schemas only. Does NOT own the tables it
--                   queries and is NOBYPASSRLS, which is what makes
--                   Postgres actually enforce the policies below -
--                   table owners and superusers bypass RLS by default.
--   gateway_role  - used only by api-gateway, to resolve an API key to
--                   a tenant_id. Read-only on platform.tenants; no
--                   access to any tenant schema at all.
--   worker_role   - used by background workers (sentiment-worker) that
--                   need to iterate "every tenant" for a startup sweep.
--                   Read-only on platform.tenants, same as gateway_role.
-- ---------------------------------------------------------------------
CREATE ROLE app_role LOGIN PASSWORD 'app_role_pw' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE gateway_role LOGIN PASSWORD 'gateway_role_pw' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE worker_role LOGIN PASSWORD 'worker_role_pw' NOSUPERUSER NOBYPASSRLS;

-- ---------------------------------------------------------------------
-- platform schema: tenant registry. Not RLS-protected (it has no
-- tenant_id column to filter on - it *is* the list of tenants). Only
-- gateway_role and worker_role can read it, and only to resolve an API
-- key or enumerate tenants; app_role has no grant here at all.
-- ---------------------------------------------------------------------
CREATE SCHEMA platform;

CREATE TABLE platform.tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    api_key     TEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA platform TO gateway_role, worker_role;
GRANT SELECT, INSERT ON platform.tenants TO gateway_role;  -- INSERT for self-serve tenant signup
GRANT SELECT ON platform.tenants TO worker_role;

-- Seed a demo tenant so the existing demo API key keeps working unchanged.
INSERT INTO platform.tenants (name, api_key)
VALUES ('Demo Tenant', 'demo-key');

-- ---------------------------------------------------------------------
-- users schema
-- ---------------------------------------------------------------------
CREATE SCHEMA users;

CREATE TABLE users.users (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               UUID NOT NULL REFERENCES platform.tenants(id),
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL,
    age_group               TEXT,
    budget_min              INT NOT NULL DEFAULT 0,
    budget_max              INT NOT NULL DEFAULT 4,
    preferred_categories    JSONB NOT NULL DEFAULT '[]',
    ambience_preferences    JSONB NOT NULL DEFAULT '[]',
    preferred_distance_km   REAL NOT NULL DEFAULT 10,
    preferred_outing_type   TEXT NOT NULL DEFAULT 'friends',
    -- Occasion prefs (ids from configs/occasions.yaml); duration from same config
    preferred_occasions     JSONB NOT NULL DEFAULT '[]',
    preferred_duration      TEXT NOT NULL DEFAULT '4-6 hours',
    home_lat                DOUBLE PRECISION,
    home_lng                DOUBLE PRECISION,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

ALTER TABLE users.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users.users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users.users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA users TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA users TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA users TO app_role;

-- ---------------------------------------------------------------------
-- places schema
-- ---------------------------------------------------------------------
CREATE SCHEMA places;

CREATE TABLE places.places (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES platform.tenants(id),
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    subcategory         TEXT,
    price_range         INT NOT NULL DEFAULT 2,
    average_cost        REAL,
    rating              REAL,
    review_count        INT NOT NULL DEFAULT 0,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    city                TEXT,
    state               TEXT,
    indoor_outdoor      TEXT NOT NULL DEFAULT 'indoor',
    ambience            JSONB NOT NULL DEFAULT '[]',
    tags                JSONB NOT NULL DEFAULT '[]',
    description         TEXT NOT NULL DEFAULT '',
    family_friendly     BOOLEAN NOT NULL DEFAULT false,
    couple_friendly     BOOLEAN NOT NULL DEFAULT false,
    friends_friendly    BOOLEAN NOT NULL DEFAULT false,
    opening_hours       JSONB NOT NULL DEFAULT '{}',
    sentiment_score     REAL NOT NULL DEFAULT 0.5,
    popularity_score    REAL NOT NULL DEFAULT 0.5,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_places_tenant_category ON places.places (tenant_id, category);
CREATE INDEX idx_places_tenant_lat ON places.places (tenant_id, lat);
CREATE INDEX idx_places_tenant_lng ON places.places (tenant_id, lng);
CREATE INDEX idx_places_tenant_city ON places.places (tenant_id, city);
CREATE INDEX idx_places_tenant_state ON places.places (tenant_id, state);

ALTER TABLE places.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE places.places FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON places.places
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA places TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA places TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA places TO app_role;

-- ---------------------------------------------------------------------
-- interactions schema
-- ---------------------------------------------------------------------
CREATE SCHEMA interactions;

CREATE TABLE interactions.interactions (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants(id),
    user_id     BIGINT NOT NULL,
    place_id    BIGINT NOT NULL,
    type        TEXT NOT NULL,
    rating      REAL,
    context     JSONB NOT NULL DEFAULT '{}',
    ts          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_tenant_user ON interactions.interactions (tenant_id, user_id);
CREATE INDEX idx_interactions_tenant_place ON interactions.interactions (tenant_id, place_id);

ALTER TABLE interactions.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions.interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interactions.interactions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA interactions TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA interactions TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA interactions TO app_role;

-- ---------------------------------------------------------------------
-- notifications schema
-- ---------------------------------------------------------------------
CREATE SCHEMA notifications;

CREATE TABLE notifications.notifications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES platform.tenants(id),
    user_id     BIGINT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    channel     TEXT NOT NULL DEFAULT 'push',
    sent        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_tenant_user ON notifications.notifications (tenant_id, user_id);

ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications.notifications
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA notifications TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA notifications TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA notifications TO app_role;

-- ---------------------------------------------------------------------
-- itineraries schema
-- ---------------------------------------------------------------------
CREATE SCHEMA itineraries;

CREATE TABLE itineraries.itineraries (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES platform.tenants(id),
    user_id             BIGINT,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    occasion            TEXT,
    duration            TEXT,
    title               TEXT,
    description         TEXT,
    budget_estimate     TEXT,
    romantic_tips       JSONB NOT NULL DEFAULT '[]',
    backup_plan         TEXT,
    timeline_meta       JSONB NOT NULL DEFAULT '[]',
    includes_breweries  BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE itineraries.itinerary_items (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES platform.tenants(id),
    itinerary_id        BIGINT NOT NULL REFERENCES itineraries.itineraries(id),
    place_id            BIGINT NOT NULL,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    indoor_outdoor      TEXT NOT NULL DEFAULT 'indoor',
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    arrival             TIMESTAMPTZ NOT NULL,
    departure           TIMESTAMPTZ NOT NULL,
    rated               BOOLEAN NOT NULL DEFAULT false,
    reminder_sent       BOOLEAN NOT NULL DEFAULT false,
    weather_alert_sent  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_itinerary_items_tenant ON itineraries.itinerary_items (tenant_id, itinerary_id);

ALTER TABLE itineraries.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries.itineraries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON itineraries.itineraries
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE itineraries.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries.itinerary_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON itineraries.itinerary_items
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT USAGE ON SCHEMA itineraries TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA itineraries TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA itineraries TO app_role;
