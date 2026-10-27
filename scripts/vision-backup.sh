#!/usr/bin/env bash
# Backs up Vision: its database without secrets (ADR-0012) and its images, to Google Drive
# through rclone: the Drive connected on the Backups page, else BACKUP_REMOTE (DEPLOY.md).
#
#   ./scripts/vision-backup.sh                 back up now
#   ./scripts/vision-backup.sh --local-only    make the local backup only; it is uploaded next time
#   ./scripts/vision-backup.sh --scheduled     what cron runs every 5 minutes: back up when the
#                                              Backups page asked for it or the daily time came
#   ./scripts/vision-backup.sh --install-cron  put that into crontab
#
# Only Vision's own Postgres container and ./demo-data are touched; production never is.
# Exit codes: 0 done (or nothing due); 3 the local backup is done but the upload failed (it is
# retried on the next run); anything else: no backup was made.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"
. "$VISION_ROOT/scripts/lib/vision-backup.sh"
shopt -s nullglob

MODE=backup
LOCAL_ONLY=false
case "${1:-}" in
  "") ;;
  --local-only) LOCAL_ONLY=true ;;
  --scheduled) MODE=scheduled ;;
  --install-cron) MODE=cron ;;
  *) vision_die "Usage: $0 [--local-only | --scheduled | --install-cron]" ;;
esac

vision_load_env
vision_guard
vb_init
vb_use_ui_remote

if [ "$MODE" = cron ]; then
  LINE="*/5 * * * * $VISION_ROOT/scripts/vision-backup.sh --scheduled >>$VB_BACKUP_DIR/cron.log 2>&1 # vision-backup"
  CURRENT="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$CURRENT" | grep -qxF "$LINE"; then
    echo "Backups are already in crontab."
    exit 0
  fi
  # an older vision-backup line (the nightly one) is replaced
  printf '%s\n%s\n' "$(printf '%s\n' "$CURRENT" | grep -v '# vision-backup$' || true)" "$LINE" | sed '/^$/d' | crontab -
  echo "Installed: $LINE"
  exit 0
fi

REQUEST_FILE="$VB_CONFIG_DIR/backup-requested"
LAST_SCHEDULED_FILE="$VB_STATUS_DIR/last-scheduled"
# once a day, in the server's time zone: due from the daily time until a backup runs after it
TIME="$(vb_setting time)"
[[ "$TIME" =~ ^([0-9]{1,2}):([0-9]{2})$ ]] || TIME="03:17"
DUE_MIN=$((10#${TIME%%:*} * 60 + 10#${TIME##*:}))
NOW_MIN=$((10#$(date +%H) * 60 + 10#$(date +%M)))
PAST_DAILY_TIME=false
[ "$NOW_MIN" -ge "$DUE_MIN" ] && PAST_DAILY_TIME=true
if [ "$MODE" = scheduled ]; then
  REASON=""
  if [ -f "$REQUEST_FILE" ]; then
    REASON="asked for on the Backups page"
  elif $PAST_DAILY_TIME && [ "$(cat "$LAST_SCHEDULED_FILE" 2>/dev/null || true)" != "$(date +%F)" ]; then
    REASON="daily at $TIME"
  fi
  [ -n "$REASON" ] || exit 0
fi

# one backup at a time: cron, the Backups page and a production copy can all start one
LOCK="$VB_BACKUP_DIR/.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  HOLDER="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$HOLDER" ] && kill -0 "$HOLDER" 2>/dev/null; then
    [ "$MODE" = scheduled ] && exit 0
    vision_die "A backup is already running (pid $HOLDER)."
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK"
fi
echo $$ >"$LOCK/pid"

if [ "$MODE" = scheduled ]; then
  echo "==> $(date '+%F %T'): backup $REASON"
  # taken before the run, so a request made meanwhile is the next run
  rm -f "$REQUEST_FILE"
fi
# Any backup after the daily time is today's daily one: "Back up now" in the afternoon does not
# trigger another at the next cron tick, and a failure is not retried every 5 minutes.
$PAST_DAILY_TIME && date +%F >"$LAST_SCHEDULED_FILE"

STATUS_FILE="$VB_STATUS_DIR/status.json"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LAST_SUCCESS="$(sed -n 's/.*"lastSuccessAt": *"\([^"]*\)".*/\1/p' "$STATUS_FILE" 2>/dev/null || true)"
STATUS_WRITTEN=false
RUNNING_SINCE=""

# The API reads this file for the Backups page and to warn admins (REQ-013-09).
write_status() {
  local succeeded="$1" error="$2" pending=0 tar success_json error_json running_json
  for tar in "$VB_BACKUP_DIR"/vision-*.tar; do
    [ -e "$tar.uploaded" ] || pending=$((pending + 1))
  done
  $succeeded && LAST_SUCCESS="$NOW"
  success_json=null
  [ -n "$LAST_SUCCESS" ] && success_json="\"$LAST_SUCCESS\""
  error_json=null
  [ -n "$error" ] && error_json="\"$(printf '%s' "$error" | tr -d '"\\' | tr '\n' ' ')\""
  running_json=null
  [ -n "$RUNNING_SINCE" ] && running_json="\"$RUNNING_SINCE\""
  printf '{"lastAttemptAt": "%s", "lastSuccessAt": %s, "lastError": %s, "pendingUploads": %s, "runningSince": %s}\n' \
    "$NOW" "$success_json" "$error_json" "$pending" "$running_json" >"$STATUS_FILE.part"
  mv "$STATUS_FILE.part" "$STATUS_FILE"
  STATUS_WRITTEN=true
}
WORK=""
trap 'code=$?; RUNNING_SINCE=""; [ -n "$WORK" ] && rm -rf "$WORK"; if [ "$code" -ne 0 ] && ! $STATUS_WRITTEN; then write_status false "backup failed (exit $code), see the log"; fi; rm -rf "$LOCK"' EXIT

RUNNING_SINCE="$NOW"
write_status false ""
STATUS_WRITTEN=false
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
    if vb_rclone copyto "$tar" "$(vb_remote_path "db/$(basename "$tar")")"; then
      touch "$tar.uploaded"
    else
      UPLOAD_ERROR="could not upload $(basename "$tar") to $BACKUP_REMOTE"
      break
    fi
  done
  if [ -z "$UPLOAD_ERROR" ]; then
    # images never change once written, so only new ones go; none are deleted on the remote
    vb_rclone copy "$VB_IMAGES_DIR" "$(vb_remote_path images)" --ignore-existing ||
      UPLOAD_ERROR="could not upload the images to $BACKUP_REMOTE"
  fi
  if [ -z "$UPLOAD_ERROR" ]; then
    for old in $(vb_remote_dumps | awk -v keep="$BACKUP_KEEP" '{ a[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print a[i] }'); do
      vb_rclone deletefile "$(vb_remote_path "db/$old")" || echo "    could not delete the old $old on the remote"
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

RUNNING_SINCE=""
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
