#!/usr/bin/env bash
# Restore a backup into a temporary Postgres container and verify row counts.
# Usage: ./deploy/restore-verify.sh <backup_file.sql.gz>
# This script is safe — it never touches the live database.

set -euo pipefail

BACKUP_FILE="${1:?Usage: restore-verify.sh <backup_file.sql.gz>}"
VERIFY_CONTAINER="outing-restore-verify-$$"
POSTGRES_IMAGE="postgres:16-alpine"
PG_USER="postgres"
PG_DB="outing"
VERIFY_PW="verify_pw"

echo "[restore-verify] Using backup: $BACKUP_FILE"
echo "[restore-verify] Starting isolated Postgres container: $VERIFY_CONTAINER"

docker run -d \
  --name "$VERIFY_CONTAINER" \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$VERIFY_PW" \
  -e POSTGRES_DB="$PG_DB" \
  "$POSTGRES_IMAGE"

cleanup() {
  echo "[restore-verify] Cleaning up container $VERIFY_CONTAINER"
  docker rm -f "$VERIFY_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for Postgres to accept TCP connections (avoids temporary initdb Unix-socket server)
READY=0
for i in $(seq 1 30); do
  if docker exec "$VERIFY_CONTAINER" pg_isready -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" && \
     docker exec -e PGPASSWORD="$VERIFY_PW" "$VERIFY_CONTAINER" \
     psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -c "SELECT 1" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "[restore-verify] Error: Postgres did not become ready over TCP in time." >&2
  exit 1
fi

echo "[restore-verify] Restoring backup..."
gzip -dc "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$VERIFY_PW" "$VERIFY_CONTAINER" \
  psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -q

echo "[restore-verify] Verifying row counts..."
docker exec -e PGPASSWORD="$VERIFY_PW" "$VERIFY_CONTAINER" \
  psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -c "
  SELECT schemaname, tablename, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY schemaname, tablename;
"

echo "[restore-verify] ✓ Restore verification complete. Check row counts above for sanity."
