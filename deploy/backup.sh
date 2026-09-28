#!/usr/bin/env bash
# Vive en el VPS (/opt/campo/src/deploy/backup.sh). Cron diario 04:45 (root):
#   45 4 * * * /opt/campo/src/deploy/backup.sh >> /opt/campo/backups/backup.log 2>&1
# Copia consistente de la base (VACUUM INTO, válido con la app corriendo) a
# /opt/campo/backups/campo-YYYY-MM-DD.sqlite.gz. Retiene 14 días.
set -euo pipefail

BACKUP_ROOT="/opt/campo/backups"
DATA_DIR="/opt/campo/data"
RETENTION_DAYS=14
DEST="$BACKUP_ROOT/campo-$(date +%F).sqlite"

[ "$BACKUP_ROOT" = "/opt/campo/backups" ] || { echo "BACKUP_ROOT inesperado, abortando" >&2; exit 1; }
mkdir -p "$BACKUP_ROOT"
rm -f "$DATA_DIR/backup-tmp.sqlite"

echo "[$(date -Is)] VACUUM INTO -> $DEST.gz"
docker compose -f /opt/campo/src/deploy/docker-compose.yml exec -T campo node -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/data/campo.sqlite', { readOnly: true }).exec(\"VACUUM INTO '/data/backup-tmp.sqlite'\");
"
mv "$DATA_DIR/backup-tmp.sqlite" "$DEST"
gzip -f "$DEST"
chmod 600 "$DEST.gz"

find "$BACKUP_ROOT" -name 'campo-*.sqlite.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Is)] listo ($(du -h "$DEST.gz" | cut -f1))"
