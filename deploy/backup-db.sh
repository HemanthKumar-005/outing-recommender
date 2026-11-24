#!/usr/bin/env bash
# Backup the outing database to a timestamped .sql.gz file.
# Usage: ./deploy/backup-db.sh [output_dir]
# Requires: docker compose stack running, pg_dump available via docker exec.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/outing_${TIMESTAMP}.sql.gz"
CONTAINER="${POSTGRES_CONTAINER:-outing-recommender-main-postgres-1}"

mkdir -p "$OUTPUT_DIR"

echo "[backup] Starting backup to $BACKUP_FILE"
docker exec "$CONTAINER" \
  pg_dump -U postgres -d outing --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

echo "[backup] Done. Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
echo "[backup] File: $BACKUP_FILE"
