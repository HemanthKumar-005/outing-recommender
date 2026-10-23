#!/usr/bin/env bash
<<<<<<< HEAD
# Encrypted PostgreSQL backup (free: pg_dump + openssl AES-256, optional rclone offsite copy).
#
#   BACKUP_PASSPHRASE   required. Store it in a password manager, NOT next to the backups.
#   RCLONE_REMOTE       optional, e.g. "gdrive:nearby-backups" (free Google Drive/Dropbox via rclone).
#   BACKUP_RETENTION_DAYS  default 14
set -euo pipefail
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DEPLOY_DIR")/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/outing_${STAMP}.sql.gz.enc"
mkdir -p "$BACKUP_DIR"
umask 077

echo "[$(date -u +%FT%TZ)] dumping database..."
docker compose --env-file "${DEPLOY_DIR}/.env.production" -f "${DEPLOY_DIR}/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-outing}" --no-owner --format=plain \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"

# A zero-byte or tiny file means the dump failed silently: refuse to call that a backup.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 2048 ]; then echo "FATAL: backup suspiciously small (${SIZE} bytes)"; rm -f "$OUT"; exit 1; fi
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT" "$RCLONE_REMOTE" && echo "copied offsite to $RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name 'outing_*.sql.gz.enc' -type f -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
=======
# =============================================================================
# Automated PostgreSQL Database Backup Script for Outing Recommender
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/outing_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL database 'outing'..."
docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U postgres -d outing | gzip > "$BACKUP_FILE"

echo "Backup created successfully: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Retention policy: remove backups older than 14 days
echo "Purging backups older than 14 days..."
find "$BACKUP_DIR" -name "outing_backup_*.sql.gz" -type f -mtime +14 -delete

echo "Backup rotation complete."
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
