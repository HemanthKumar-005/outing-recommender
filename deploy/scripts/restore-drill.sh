#!/usr/bin/env bash
# Restore drill: decrypt the newest (or given) backup into a THROWAWAY Postgres container,
# run verify-restore.sql, and report how long it took (your measured RTO). Never touches production.
#   BACKUP_PASSPHRASE required.  Usage: ./restore-drill.sh [backup-file]
set -euo pipefail
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$(dirname "$SCRIPT_DIR")")/backups}"
FILE="${1:-$(ls -1t "$BACKUP_DIR"/outing_*.sql.gz.enc | head -1)}"
[ -f "$FILE" ] || { echo "no backup found"; exit 1; }
NAME="restore-drill-$$"
START=$(date +%s)
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=outing postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$NAME" psql -U postgres -d outing -c "CREATE EXTENSION IF NOT EXISTS pgcrypto" >/dev/null
# roles referenced by GRANTs must exist for the restore to apply them
for r in app_role gateway_role worker_role trainer_role; do docker exec "$NAME" psql -U postgres -c "CREATE ROLE $r NOLOGIN" >/dev/null; done

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | gunzip \
  | docker exec -i "$NAME" psql -U postgres -d outing -v ON_ERROR_STOP=1 -q >/dev/null
docker exec -i "$NAME" psql -U postgres -d outing -v ON_ERROR_STOP=1 < "$SCRIPT_DIR/verify-restore.sql"
echo "restore drill OK in $(( $(date +%s) - START ))s using $(basename "$FILE")"
