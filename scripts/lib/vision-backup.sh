# Shared by scripts/vision-backup.sh, scripts/vision-restore.sh and
# scripts/demo-clone-from-prod.sh. Needs lib/vision-safety.sh loaded first.
#
# A backup is one vision-<UTC time>.tar holding:
#   db.dump       pg_dump -Fc of Vision's database without the rows of "User" and "Project"
#   user.csv      "User" rows with the secret columns blanked
#   project.csv   "Project" rows with the secret columns blanked
#   manifest.txt  schema version and row counts, to check a restore against
# Both parts come from one database snapshot, so rows referring to users and
# projects always find them.
#
# Secrets never enter a backup (ADR-0012). Add every new secret column here.
VB_SECRET_COLUMNS="User.password=!restored User.jiraToken= Project.jiraToken="

# Call after vision_load_env: paths and the database come from .env.demo.
vb_init() {
  VISION_DATA_DIR="${VISION_DATA_DIR:-$VISION_ROOT/demo-data}"
  VB_BACKUP_DIR="$VISION_DATA_DIR/backups"
  VB_STATUS_DIR="$VISION_DATA_DIR/backup-status"
  VB_IMAGES_DIR="$VISION_DATA_DIR/imageUploads"
  # written by the API from the Backups page (ADR-0013)
  VB_CONFIG_DIR="$VISION_DATA_DIR/backup-config"
  VB_PG_USER="${POSTGRES_USER:-postgres}"
  VB_PG_DB="${POSTGRES_DB:-vrt_demo}"
  BACKUP_REMOTE="${BACKUP_REMOTE:-}"
  BACKUP_KEEP="${BACKUP_KEEP:-7}"
  mkdir -p "$VB_BACKUP_DIR" "$VB_STATUS_DIR" "$VB_IMAGES_DIR" "$VB_CONFIG_DIR"
}

# A value from the Backups page settings (backup-config/settings.json, written by the API).
vb_setting() {
  sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$VB_CONFIG_DIR/settings.json" 2>/dev/null | head -1 || true
}

# Google Drive connected on the Backups page wins over BACKUP_REMOTE and BACKUP_KEEP (REQ-017-21).
vb_use_ui_remote() {
  local keep
  grep -qx '\[vision-drive\]' "$VB_CONFIG_DIR/rclone.conf" 2>/dev/null || return 0
  RCLONE_CONFIG_DIR="$VB_CONFIG_DIR"
  BACKUP_REMOTE="vision-drive:"
  keep="$(vb_setting keep)"
  [[ "$keep" =~ ^[0-9]+$ ]] && [ "$keep" -gt 0 ] && BACKUP_KEEP="$keep"
  return 0
}

# A path on the remote: "vision-drive:" is the backup folder itself, "gdrive:folder" a folder in it.
vb_remote_path() {
  if [[ "$BACKUP_REMOTE" == *: ]]; then echo "$BACKUP_REMOTE$1"; else echo "$BACKUP_REMOTE/$1"; fi
}

# Vision's own Postgres container, checked by vision_container; empty when it is not running.
vb_use_vision_pg() {
  VB_PG="$(vision_container postgres)"
}

vb_sql() {
  docker exec -i "$VB_PG" psql -X -v ON_ERROR_STOP=1 -q -tA -U "$VB_PG_USER" -d "$VB_PG_DB" "$@" | tr -d '\r'
}

# The SELECT list of a table with each secret column replaced: by its placeholder,
# or by NULL when the placeholder is empty. Column names come from the database,
# so columns added by later migrations are backed up without changes here.
vb_select_list() {
  local table="$1" list="" column entry found value
  for column in $(vb_sql -c "select column_name from information_schema.columns where table_schema = 'public' and table_name = '$table' order by ordinal_position"); do
    found=false
    value=""
    for entry in $VB_SECRET_COLUMNS; do
      if [ "${entry%%=*}" = "$table.$column" ]; then
        found=true
        value="${entry#*=}"
      fi
    done
    if ! $found; then
      list="$list, \"$column\""
    elif [ -z "$value" ]; then
      list="$list, NULL AS \"$column\""
    else
      list="$list, '$value' AS \"$column\""
    fi
  done
  echo "${list#, }"
}

# Row counts compared after a restore.
VB_COUNTED_TABLES="Project Build TestRun TestVariation Baseline User"

# Writes db.dump, user.csv, project.csv and manifest.txt into $1.
vb_dump() {
  local work="$1" fifo="$1/snapshot.ctl" out="$1/snapshot.out" holder snapshot="" tries=0 table select
  mkfifo "$fifo"
  # One session holds a read-only snapshot open; pg_dump and the COPYs join it.
  docker exec -i "$VB_PG" psql -X -q -tA -U "$VB_PG_USER" -d "$VB_PG_DB" <"$fifo" >"$out" 2>&1 &
  holder=$!
  exec 3>"$fifo"
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n' >&3
  while [ -z "$snapshot" ]; do
    snapshot="$(grep -Eo '^[0-9A-F]+-[0-9A-F]+-[0-9]+$' "$out" 2>/dev/null | head -1 || true)"
    [ -n "$snapshot" ] && break
    tries=$((tries + 1))
    if [ "$tries" -gt 300 ]; then
      exec 3>&-
      wait "$holder" 2>/dev/null || true
      vision_die "Could not open a database snapshot for the backup: $(cat "$out")"
    fi
    sleep 0.1
  done

  docker exec "$VB_PG" sh -c 'if command -v nice >/dev/null; then exec nice -n 19 "$@"; else exec "$@"; fi' sh \
    pg_dump -U "$VB_PG_USER" -d "$VB_PG_DB" -Fc --snapshot="$snapshot" \
    --exclude-table-data='"User"' --exclude-table-data='"Project"' >"$work/db.dump"

  for table in User Project; do
    select="$(vb_select_list "$table")"
    [ -n "$select" ] || vision_die "Vision's database has no \"$table\" table."
    printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET TRANSACTION SNAPSHOT %s;\nCOPY (SELECT %s FROM "%s") TO STDOUT WITH (FORMAT csv, HEADER);\nCOMMIT;\n' \
      "'$snapshot'" "$select" "$table" | vb_sql >"$work/$(echo "$table" | tr '[:upper:]' '[:lower:]').csv"
  done

  echo "created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$work/manifest.txt"
  {
    printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
    echo "select 'migration=' || coalesce(max(migration_name), '') from _prisma_migrations where finished_at is not null;"
    for table in $VB_COUNTED_TABLES; do
      printf "select '%s=' || count(*) from \"%s\";\n" "$table" "$table"
    done
    echo "COMMIT;"
  } | vb_sql >>"$work/manifest.txt"
  echo "imagesKb=$(du -sk "$VB_IMAGES_DIR" 2>/dev/null | awk '{print $1}')" >>"$work/manifest.txt"

  printf 'COMMIT;\n' >&3
  exec 3>&-
  wait "$holder" || true
  rm -f "$fifo" "$out"
}

vb_manifest_value() {
  sed -n "s/^$2=//p" "$1" | head -1
}

# The remote is BACKUP_REMOTE, e.g. gdrive:vision-backups. rclone runs from the host when it
# is installed there, else from its Docker image, so nothing has to be installed on a server
# that cannot reach rclone.org. Its config (and a service account key) live in RCLONE_CONFIG_DIR;
# Vision's data folder is mounted at the same path, so local paths mean the same inside.
VB_RCLONE_IMAGE="rclone/rclone:1.68.2"
vb_rclone() {
  if command -v rclone >/dev/null; then
    if [ -n "${RCLONE_CONFIG_DIR:-}" ]; then RCLONE_CONFIG="$RCLONE_CONFIG_DIR/rclone.conf" rclone "$@"; else rclone "$@"; fi
    return
  fi
  local config="${RCLONE_CONFIG_DIR:-$HOME/.config/rclone}"
  [ -f "$config/rclone.conf" ] || vision_die "No rclone config in $config (see DEPLOY.md, backups)."
  docker run --rm --user "$(id -u):$(id -g)" \
    -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e https_proxy -e http_proxy -e no_proxy \
    -v "$config:/config/rclone" -v "$VISION_DATA_DIR:$VISION_DATA_DIR" \
    "$VB_RCLONE_IMAGE" "$@"
}

# Image files under imageUploads, relative and sorted: what a backup of the database may need.
vb_image_list() {
  (cd "$VB_IMAGES_DIR" && find . -type f ! -name '.*' | sed 's#^\./##') | LC_ALL=C sort
}

# Deletes images on the remote that no kept database backup lists (REQ-013-21). Each backup
# keeps the list of images there were when it was made (db/vision-<time>.images.txt), so any
# kept backup restores with all its images; until every kept backup has a list (backups made
# before lists existed), nothing is deleted.
vb_prune_remote_images() {
  local work="$VB_BACKUP_DIR/.prune-$$" name dumps count
  dumps="$(vb_remote_dumps)"
  [ -n "$dumps" ] || return 0
  rm -rf "$work"
  mkdir -p "$work"
  for name in $dumps; do
    if ! vb_rclone cat "$(vb_remote_path "db/${name%.tar}.images.txt")" >"$work/$name.txt" 2>/dev/null; then
      echo "    $name has no list of images; no images are deleted until it is gone"
      rm -rf "$work"
      return 0
    fi
  done
  cat "$work"/*.txt | LC_ALL=C sort -u >"$work/keep"
  # an empty list would mean deleting every image: never
  if [ ! -s "$work/keep" ] || ! vb_rclone lsf "$(vb_remote_path images)" --files-only -R >"$work/remote.raw" 2>/dev/null; then
    rm -rf "$work"
    return 0
  fi
  LC_ALL=C sort "$work/remote.raw" >"$work/remote"
  LC_ALL=C comm -23 "$work/remote" "$work/keep" >"$work/delete"
  count="$(wc -l <"$work/delete" | tr -d ' ')"
  if [ "$count" -gt 0 ]; then
    echo "==> Deleting $count images no kept backup needs"
    vb_rclone delete "$(vb_remote_path images)" --files-from "$work/delete" ||
      echo "    could not delete them; next time"
  fi
  rm -rf "$work"
}

# Backup names on the remote, oldest first; none when it is empty or unreachable.
vb_remote_dumps() {
  { vb_rclone lsf "$(vb_remote_path db)" --files-only 2>/dev/null || true; } | grep -E '^vision-[0-9TZ]+\.tar$' | sort || true
}
