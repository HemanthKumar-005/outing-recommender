#!/bin/bash
# Creates the shared consumer tenant that backs the public web app.
# Its API key is random and discarded: it exists only so that rows have a
# tenant_id. Nobody can authenticate with it; web users get per-user sessions.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
INSERT INTO platform.tenants (name, api_key_hash, api_key_prefix, is_consumer)
VALUES (
  'Nearby Consumers',
  encode(digest(gen_random_bytes(32), 'sha256'), 'hex'),
  'nb_consumer',
  true
);
SQL
