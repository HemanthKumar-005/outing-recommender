#!/usr/bin/env bash
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
