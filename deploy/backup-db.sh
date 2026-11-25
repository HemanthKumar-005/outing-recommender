#!/usr/bin/env bash
# Backup the outing database to a timestamped .sql.gz file.
# Usage: ./deploy/backup-db.sh [output_dir]
# Requires: docker compose stack running, pg_dump available via docker exec.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/outing_${TIMESTAMP}.sql.gz"
CONTAINER="${POSTGRES_CONTAINER:-}"
if [ -n "$CONTAINER" ] && ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "[backup] Warning: Container '$CONTAINER' not found. Auto-detecting postgres container..." >&2
  CONTAINER=""
fi

if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker compose ps -q postgres 2>/dev/null || true)
fi

if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" 2>/dev/null | head -n1 || true)
fi

if [ -z "$CONTAINER" ]; then
  echo "[backup] Error: No running postgres container found." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "[backup] Using container: $CONTAINER"
echo "[backup] Starting backup to $BACKUP_FILE"
docker exec "$CONTAINER" \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-outing}" --no-owner --no-acl' \
  | gzip > "$BACKUP_FILE"

echo "[backup] Done. Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
echo "[backup] File: $BACKUP_FILE"
