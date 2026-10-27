#!/usr/bin/env bash
# Backs up Vision: its database without secrets (ADR-0012) and its images, to
# BACKUP_REMOTE, a Google Drive folder reached through rclone (DEPLOY.md).
#
#   ./scripts/vision-backup.sh                 back up now (what cron runs)
#   ./scripts/vision-backup.sh --local-only    make the local backup only; it is uploaded next time
#   ./scripts/vision-backup.sh --install-cron  back up every night at 03:17
#
# Only Vision's own Postgres container and ./demo-data are touched; production never is.
# Exit codes: 0 done; 3 the local backup is done but the upload failed (it is retried
# on the next run); anything else: no backup was made.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"
. "$VISION_ROOT/scripts/lib/vision-backup.sh"
shopt -s nullglob

MODE=backup
LOCAL_ONLY=false
case "${1:-}" in
  "") ;;
  --local-only) LOCAL_ONLY=true ;;
  --install-cron) MODE=cron ;;
  *) vision_die "Usage: $0 [--local-only | --install-cron]" ;;
esac

vision_load_env
vision_guard
vb_init

if [ "$MODE" = cron ]; then
  LINE="17 3 * * * $VISION_ROOT/scripts/vision-backup.sh >>$VB_BACKUP_DIR/cron.log 2>&1 # vision-backup"
  CURRENT="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$CURRENT" | grep -q '# vision-backup$'; then
    echo "The nightly backup is already in crontab."
    exit 0
  fi
  printf '%s\n%s\n' "$CURRENT" "$LINE" | sed '/^$/d' | crontab -
  echo "Installed: $LINE"
  exit 0
fi

STATUS_FILE="$VB_STATUS_DIR/status.json"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LAST_SUCCESS="$(sed -n 's/.*"lastSuccessAt": *"\([^"]*\)".*/\1/p' "$STATUS_FILE" 2>/dev/null || true)"
STATUS_WRITTEN=false

# The API reads this file to warn admins when the last upload is too old (REQ-013-09).
write_status() {
  local succeeded="$1" error="$2" pending=0 tar success_json error_json
  for tar in "$VB_BACKUP_DIR"/vision-*.tar; do
    [ -e "$tar.uploaded" ] || pending=$((pending + 1))
  done
  $succeeded && LAST_SUCCESS="$NOW"
  success_json=null
  [ -n "$LAST_SUCCESS" ] && success_json="\"$LAST_SUCCESS\""
  error_json=null
  [ -n "$error" ] && error_json="\"$(printf '%s' "$error" | tr -d '"\\' | tr '\n' ' ')\""
  printf '{"lastAttemptAt": "%s", "lastSuccessAt": %s, "lastError": %s, "pendingUploads": %s}\n' \
    "$NOW" "$success_json" "$error_json" "$pending" >"$STATUS_FILE.part"
  mv "$STATUS_FILE.part" "$STATUS_FILE"
  STATUS_WRITTEN=true
}
WORK=""
trap 'code=$?; [ -n "$WORK" ] && rm -rf "$WORK"; if [ "$code" -ne 0 ] && ! $STATUS_WRITTEN; then write_status false "backup failed (exit $code), see the log"; fi' EXIT

vb_use_vision_pg
[ -n "$VB_PG" ] || vision_die "Vision's Postgres is not running. Start Vision first: ./scripts/vision.sh up -d"

DB_BYTES="$(vb_sql -c 'select pg_database_size(current_database())')"
[[ "$DB_BYTES" =~ ^[0-9]+$ ]] || vision_die "Could not read the size of Vision's database ($DB_BYTES)."
vision_require_space "$VB_BACKUP_DIR" $((DB_BYTES / 1024)) "the backup"

NAME="vision-$(date -u +%Y%m%dT%H%M%SZ).tar"
# two runs within a second (the nightly one and one before a production copy) must not
# overwrite each other, least of all a backup still waiting for upload
while [ -e "$VB_BACKUP_DIR/$NAME" ]; do
  sleep 1
  NAME="vision-$(date -u +%Y%m%dT%H%M%SZ).tar"
done
WORK="$VB_BACKUP_DIR/.work-$$"
rm -rf "$WORK"
mkdir -p "$WORK"
echo "==> Dumping Vision's database without passwords and Jira tokens"
vb_dump "$WORK"
tar -C "$WORK" -cf "$VB_BACKUP_DIR/$NAME.part" db.dump user.csv project.csv manifest.txt
mv "$VB_BACKUP_DIR/$NAME.part" "$VB_BACKUP_DIR/$NAME"
rm -rf "$WORK"
echo "    $NAME ($(du -h "$VB_BACKUP_DIR/$NAME" | cut -f1))"

UPLOAD_ERROR=""
if [ -n "$BACKUP_REMOTE" ] && ! $LOCAL_ONLY; then
  echo "==> Uploading to $BACKUP_REMOTE"
  # older backups that could not be uploaded before go first
  for tar in "$VB_BACKUP_DIR"/vision-*.tar; do
    [ -e "$tar.uploaded" ] && continue
    if vb_rclone copyto "$tar" "$BACKUP_REMOTE/db/$(basename "$tar")"; then
      touch "$tar.uploaded"
    else
      UPLOAD_ERROR="could not upload $(basename "$tar") to $BACKUP_REMOTE"
      break
    fi
  done
  if [ -z "$UPLOAD_ERROR" ]; then
    # images never change once written, so only new ones go; none are deleted on the remote
    vb_rclone copy "$VB_IMAGES_DIR" "$BACKUP_REMOTE/images" --ignore-existing ||
      UPLOAD_ERROR="could not upload the images to $BACKUP_REMOTE"
  fi
  if [ -z "$UPLOAD_ERROR" ]; then
    for old in $(vb_remote_dumps | awk -v keep="$BACKUP_KEEP" '{ a[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print a[i] }'); do
      vb_rclone deletefile "$BACKUP_REMOTE/db/$old" || echo "    could not delete the old $old on the remote"
    done
  fi
fi

# Locally: the 2 newest uploaded backups and every one still waiting for upload;
# without a remote, the BACKUP_KEEP newest.
KEEP_LOCAL=2
[ -n "$BACKUP_REMOTE" ] || KEEP_LOCAL="$BACKUP_KEEP"
for tar in "$VB_BACKUP_DIR"/vision-*.tar; do
  if [ -z "$BACKUP_REMOTE" ] || [ -e "$tar.uploaded" ]; then echo "$tar"; fi
done | awk -v keep="$KEEP_LOCAL" 'NF { a[++n] = $0 } END { for (i = 1; i <= n - keep; i++) print a[i] }' |
  while read -r tar; do rm -f "$tar" "$tar.uploaded"; done

if [ -n "$UPLOAD_ERROR" ]; then
  write_status false "$UPLOAD_ERROR"
  echo "!!  $UPLOAD_ERROR. The backup stays in $VB_BACKUP_DIR and is uploaded on the next run." >&2
  exit 3
fi
if [ -n "$BACKUP_REMOTE" ] && $LOCAL_ONLY; then
  write_status false ""
  echo "==> Done locally; it is uploaded on the next run."
else
  write_status true ""
  echo "==> Done."
fi
