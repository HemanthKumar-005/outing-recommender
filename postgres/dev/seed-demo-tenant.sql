-- LOCAL DEVELOPMENT ONLY. Never mounted by deploy/docker-compose.prod.yml.
-- Creates a B2B-style demo tenant whose API key is the literal string "demo-key"
-- so scripts/seed_data.py and curl examples work on a developer machine.
INSERT INTO platform.tenants (name, api_key_hash, api_key_prefix)
VALUES ('Local Demo Tenant', encode(digest('demo-key', 'sha256'), 'hex'), 'demo-key')
ON CONFLICT (api_key_hash) DO NOTHING;
