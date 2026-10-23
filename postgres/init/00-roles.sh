#!/bin/sh
# Creates the least-privilege application roles. Passwords come from the
# environment -- there is no default, and the container fails fast if one is
# missing. Runs once, on first initialisation of an empty data directory.
set -eu

for v in APP_ROLE_PW GATEWAY_ROLE_PW WORKER_ROLE_PW TRAINER_ROLE_PW; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then
    echo "FATAL: environment variable $v must be set (see deploy/.env.production.example)" >&2
    exit 1
  fi
done

# psql variables are quoted safely with :'name' -- no shell interpolation into SQL.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_pw="$APP_ROLE_PW" -v gateway_pw="$GATEWAY_ROLE_PW" \
  -v worker_pw="$WORKER_ROLE_PW" -v trainer_pw="$TRAINER_ROLE_PW" <<'SQL'
CREATE ROLE app_role     LOGIN PASSWORD :'app_pw'     NOSUPERUSER NOBYPASSRLS;
CREATE ROLE gateway_role LOGIN PASSWORD :'gateway_pw' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE worker_role  LOGIN PASSWORD :'worker_pw'  NOSUPERUSER NOBYPASSRLS;
-- trainer_role: read-only role for model-training-worker (SELECT on interactions only).
CREATE ROLE trainer_role LOGIN PASSWORD :'trainer_pw' NOSUPERUSER NOBYPASSRLS;
SQL
