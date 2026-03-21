#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Mira Backend — PostgreSQL Backup
# Usage: ./scripts/backup.sh <server-ip>
# Add to crontab: 0 3 * * * /opt/mira/scripts/backup.sh localhost
# ============================================

REMOTE_DIR="/opt/mira"
BACKUP_DIR="/opt/mira/backups"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# Load credentials
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "$REMOTE_DIR/.env.prod")

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mira_${TIMESTAMP}.sql.gz"

# Dump and compress
docker compose -f "$REMOTE_DIR/docker-compose.yml" exec -T db \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

# Clean old backups
find "$BACKUP_DIR" -name "mira_*.sql.gz" -mtime +$RETENTION_DAYS -delete

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: $BACKUP_FILE ($SIZE)"
