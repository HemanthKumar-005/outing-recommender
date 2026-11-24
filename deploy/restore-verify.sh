#!/usr/bin/env bash
# Restore a backup into a temporary Postgres container and verify row counts.
# Usage: ./deploy/restore-verify.sh <backup_file.sql.gz>
# This script is safe — it never touches the live database.

set -euo pipefail

BACKUP_FILE="${1:?Usage: restore-verify.sh <backup_file.sql.gz>}"
VERIFY_CONTAINER="outing-restore-verify-$$"
POSTGRES_IMAGE="postgres:15-alpine"

echo "[restore-verify] Using backup: $BACKUP_FILE"
echo "[restore-verify] Starting isolated Postgres container: $VERIFY_CONTAINER"

docker run -d \
  --name "$VERIFY_CONTAINER" \
  -e POSTGRES_PASSWORD=verify_pw \
  -e POSTGRES_DB=outing \
  "$POSTGRES_IMAGE"

cleanup() {
  echo "[restore-verify] Cleaning up container $VERIFY_CONTAINER"
  docker rm -f "$VERIFY_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for Postgres to be ready
for i in $(seq 1 20); do
  docker exec "$VERIFY_CONTAINER" pg_isready -U postgres && break
  sleep 1
done

echo "[restore-verify] Restoring backup..."
zcat "$BACKUP_FILE" | docker exec -i "$VERIFY_CONTAINER" \
  psql -U postgres -d outing -q

echo "[restore-verify] Verifying row counts..."
docker exec "$VERIFY_CONTAINER" psql -U postgres -d outing -c "
  SELECT schemaname, tablename, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY schemaname, tablename;
"

echo "[restore-verify] ✓ Restore verification complete. Check row counts above for sanity."
