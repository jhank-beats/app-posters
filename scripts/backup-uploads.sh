#!/usr/bin/env bash
# Backup de pósters subidos (UPLOAD_DIR).
# Uso: scripts/backup-uploads.sh [DESTINO]
# Por defecto: /var/backups/app-posters/uploads-YYYYmmdd-HHMMSS.tar.gz
set -euo pipefail

UPLOAD_DIR="${UPLOAD_DIR:-/srv/posters-uploads}"
DEST_BASE="${1:-/var/backups/app-posters}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${DEST_BASE}/uploads-${STAMP}.tar.gz"

if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "UPLOAD_DIR no existe: $UPLOAD_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_BASE"
tar -czf "$OUT" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
echo "Backup creado: $OUT"
# Conservar solo los últimos 14 backups
ls -1t "${DEST_BASE}"/uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
