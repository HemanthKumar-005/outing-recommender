-- Sanity checks run against a RESTORED copy of the database. Any failure raises an exception.
DO $$
DECLARE n int;
BEGIN
  -- 1. Core tables exist
  FOR n IN SELECT 1 WHERE to_regclass('platform.tenants') IS NULL OR to_regclass('users.users') IS NULL
       OR to_regclass('places.places') IS NULL OR to_regclass('interactions.interactions') IS NULL
       OR to_regclass('itineraries.itineraries') IS NULL OR to_regclass('notifications.notifications') IS NULL
  LOOP RAISE EXCEPTION 'restore check failed: a core table is missing'; END LOOP;

  -- 2. Row-level security survived the restore on every tenant-owned table
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname IN ('users','places','interactions','itineraries','notifications')
     AND c.relkind = 'r' AND c.relname NOT IN ('schema_migrations')
     AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
     AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id');
  IF n > 0 THEN RAISE EXCEPTION 'restore check failed: % tenant tables lost FORCE ROW LEVEL SECURITY', n; END IF;

  -- 3. Policies exist
  SELECT count(*) INTO n FROM pg_policies WHERE policyname = 'tenant_isolation';
  IF n < 5 THEN RAISE EXCEPTION 'restore check failed: only % tenant_isolation policies found', n; END IF;

  -- 4. API keys are stored hashed (64 hex chars), never in clear text
  SELECT count(*) INTO n FROM platform.tenants WHERE api_key_hash !~ '^[0-9a-f]{64}$';
  IF n > 0 THEN RAISE EXCEPTION 'restore check failed: % tenants have a non-hash api_key_hash', n; END IF;

  -- 5. Referential integrity: no orphaned interactions
  SELECT count(*) INTO n FROM interactions.interactions i LEFT JOIN users.users u ON u.id = i.user_id WHERE u.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'restore check failed: % orphaned interactions', n; END IF;
END $$;

SELECT 'restore verification passed' AS result,
       (SELECT count(*) FROM platform.tenants) AS tenants,
       (SELECT count(*) FROM users.users)      AS users,
       (SELECT count(*) FROM places.places)    AS places;
