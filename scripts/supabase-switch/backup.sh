#!/usr/bin/env bash
# Nightly dump of the self-hosted database, keeping the last $KEEP days.
# Self-hosting means backups are ours; copy $BACKUP_DIR off the VPS too.
#
#   crontab: 15 3 * * * /home/duc/yeahbuddy-ops/supabase-switch/backup.sh >>/home/duc/backups/backup.log 2>&1
. "$(dirname "$0")/lib.sh"

KEEP=${KEEP:-7}
umask 077
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/vps-$(date +%Y%m%d-%H%M%S).dump"
pg_dump_on vps -Fc --schema=public --schema=auth --schema=storage >"$file.partial"
mv "$file.partial" "$file"
log "$(date -Is) wrote $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -name 'vps-*.dump' -mtime +"$KEEP" -print -delete
