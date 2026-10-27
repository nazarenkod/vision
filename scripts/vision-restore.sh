#!/usr/bin/env bash
# Restores Vision from a backup made by scripts/vision-backup.sh.
#
#   ./scripts/vision-restore.sh                                the newest backup
#   ./scripts/vision-restore.sh vision-20261027T031700Z.tar    that one, from BACKUP_REMOTE or ./demo-data/backups
#   ./scripts/vision-restore.sh /path/to/vision-....tar        a file
#   --yes                                                      skip the confirmation
#
# Backups hold no passwords or Jira tokens (ADR-0012). Afterwards you sign in with the
# master email and password: VISION_MASTER_EMAIL and VISION_MASTER_PASSWORD from
# .env.demo, or asked here. That user becomes an admin; other users sign in once an
# admin sets them a password. API keys come back as they were, so autotests need no change.
#
# Only Vision's own Postgres container and ./demo-data are written; production never is.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"
. "$VISION_ROOT/scripts/lib/vision-backup.sh"
shopt -s nullglob

ASSUME_YES=false
WHICH=""
for arg in "$@"; do
  if [ "$arg" = "--yes" ]; then ASSUME_YES=true; else WHICH="$arg"; fi
done

vision_load_env
vision_guard
vb_init
vb_use_ui_remote

# ---- master sign-in, checked before anything else -------------------------------------

MASTER_EMAIL="${VISION_MASTER_EMAIL:-}"
MASTER_PASSWORD="${VISION_MASTER_PASSWORD:-}"
[ -n "$MASTER_EMAIL" ] || read -r -p "Master email: " MASTER_EMAIL || true
if [ -z "$MASTER_PASSWORD" ]; then
  read -r -s -p "Master password: " MASTER_PASSWORD || true
  echo
fi
[[ "$MASTER_EMAIL" == *@* ]] || vision_die "Set VISION_MASTER_EMAIL in $VISION_ENV_FILE or type an email address. Nothing was done."
[ "${#MASTER_PASSWORD}" -ge 12 ] ||
  vision_die "The master password must be at least 12 characters (VISION_MASTER_PASSWORD). Nothing was done."

# ---- which backup ----------------------------------------------------------------------

if [ -n "$WHICH" ] && [ -f "$WHICH" ]; then
  TAR="$WHICH"
else
  NAME="$WHICH"
  if [ -z "$NAME" ]; then
    # the newest of the remote ones and the local ones not uploaded yet
    NAME="$({
      [ -n "$BACKUP_REMOTE" ] && vb_remote_dumps
      for tar in "$VB_BACKUP_DIR"/vision-*.tar; do basename "$tar"; done
    } | sort | tail -1)"
    [ -n "$NAME" ] || vision_die "No backups found${BACKUP_REMOTE:+ on $(vb_remote_path db)} or in $VB_BACKUP_DIR."
  fi
  TAR="$VB_BACKUP_DIR/$NAME"
  if [ ! -f "$TAR" ]; then
    [ -n "$BACKUP_REMOTE" ] || vision_die "No backup $TAR."
    echo "==> Downloading $NAME from $BACKUP_REMOTE"
    vb_rclone copyto "$(vb_remote_path "db/$NAME")" "$TAR.part" || vision_die "Could not download $NAME from $(vb_remote_path db)."
    mv "$TAR.part" "$TAR"
  fi
fi

WORK="$VB_BACKUP_DIR/.restore-$$"
rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
tar -C "$WORK" -xf "$TAR"
for part in db.dump user.csv project.csv manifest.txt; do
  [ -f "$WORK/$part" ] || vision_die "$TAR is not a Vision backup (no $part)."
done
MANIFEST="$WORK/manifest.txt"
counts() {
  echo "$(vb_manifest_value "$MANIFEST" Project) projects, $(vb_manifest_value "$MANIFEST" Build) builds, $(vb_manifest_value "$MANIFEST" TestRun) test runs, $(vb_manifest_value "$MANIFEST" TestVariation) baselines, $(vb_manifest_value "$MANIFEST" User) users"
}

DUMP_KB="$(du -sk "$WORK/db.dump" | awk '{print $1}')"
IMAGES_KB="$(vb_manifest_value "$MANIFEST" imagesKb)"
HAVE_KB="$(du -sk "$VB_IMAGES_DIR" | awk '{print $1}')"
NEED_IMAGES_KB=0
[ -n "$BACKUP_REMOTE" ] && [ "${IMAGES_KB:-0}" -gt "$HAVE_KB" ] && NEED_IMAGES_KB=$((IMAGES_KB - HAVE_KB))
# the restored database takes a few times its compressed dump
vision_require_space "$VISION_DATA_DIR" $((DUMP_KB * 4 + NEED_IMAGES_KB)) "the restore"

echo "Restore Vision from $(basename "$TAR") (made $(vb_manifest_value "$MANIFEST" created))"
echo "  backup:          $(counts); schema $(vb_manifest_value "$MANIFEST" migration)"
echo "  replaced:        Vision's database (its API and UI stop meanwhile)"
if [ -n "$BACKUP_REMOTE" ]; then
  echo "  images:          missing ones are downloaded from $(vb_remote_path images)"
else
  echo "  images:          kept as they are in $VB_IMAGES_DIR (BACKUP_REMOTE is not set)"
fi
echo "  sign-in:         $MASTER_EMAIL becomes an admin with the master password;"
echo "                   other users sign in once an admin sets them a password"
echo "  production is not touched."
if ! $ASSUME_YES; then
  read -r -p "Type yes to continue: " answer || true
  [ "$answer" = "yes" ] || { echo "Nothing done."; exit 0; }
fi

# ---- images first: a failed download leaves the database as it was ---------------------

if [ -n "$BACKUP_REMOTE" ]; then
  echo "==> Downloading missing images"
  vb_rclone copy "$(vb_remote_path images)" "$VB_IMAGES_DIR" --ignore-existing ||
    vision_die "Could not download the images from $(vb_remote_path images). The database was not touched."
fi

# ---- database ----------------------------------------------------------------------------

echo "==> Starting Vision's Postgres"
vision_compose up -d postgres
until vision_compose exec -T postgres pg_isready -U "$VB_PG_USER" -d "$VB_PG_DB" >/dev/null 2>&1; do sleep 2; done
vb_use_vision_pg
[ -n "$VB_PG" ] || vision_die "Vision's Postgres did not start."
[ "$VB_PG" != "$(docker inspect -f '{{.Id}}' "${PROD_PG_CONTAINER:-none}" 2>/dev/null || true)" ] ||
  vision_die "Vision's Postgres and production's are the same container. Nothing was done."

echo "==> Restoring the database"
vision_compose stop api ui >/dev/null 2>&1 || true
vb_sql -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
restore_section() {
  docker exec -i "$VB_PG" pg_restore --no-owner --no-privileges --section="$1" -U "$VB_PG_USER" -d "$VB_PG_DB" <"$WORK/db.dump" ||
    echo "    pg_restore reported warnings ($1); the checks below tell whether the restore is usable"
}
restore_section pre-data
restore_section data
# users and projects come from the CSVs, before keys and indexes are created
for table in User Project; do
  csv="$WORK/$(echo "$table" | tr '[:upper:]' '[:lower:]').csv"
  columns="$(head -1 "$csv" | tr -d '\r' | sed 's/[^,]*/"&"/g')"
  vb_sql -c "COPY \"$table\" ($columns) FROM STDIN WITH (FORMAT csv, HEADER)" <"$csv"
done
restore_section post-data

for table in $VB_COUNTED_TABLES; do
  expected="$(vb_manifest_value "$MANIFEST" "$table")"
  got="$(vb_sql -c "select count(*) from \"$table\"")"
  [ "$got" = "$expected" ] ||
    vision_die "The restored database has $got rows in \"$table\", the backup $expected. Vision was left stopped; see the messages above."
done
echo "    restored: $(counts)"

echo "==> Master admin $MASTER_EMAIL"
# bcrypt as the API does it, in a one-off container of the API image; the password goes
# through stdin, never into arguments or the environment
HASH_AND_KEY="$(printf '%s' "$MASTER_PASSWORD" | vision_compose run --rm -T --no-deps --entrypoint node api -e '
let password = "";
process.stdin.on("data", (chunk) => (password += chunk)).on("end", async () => {
  const hash = await require("bcryptjs").hash(password, 10);
  const apiKey = require("uuid-apikey").create({ noDashes: true }).apiKey;
  console.log(hash + " " + apiKey);
});')"
HASH="$(echo "$HASH_AND_KEY" | tail -1 | awk '{print $1}')"
NEW_KEY="$(echo "$HASH_AND_KEY" | tail -1 | awk '{print $2}')"
[[ "$HASH" == \$2* ]] && [ -n "$NEW_KEY" ] || vision_die "Could not hash the master password with the API image: $HASH_AND_KEY"
# the API key is only used when the master user is new; an existing one keeps theirs
vb_sql -v email="$MASTER_EMAIL" -v hash="$HASH" -v apikey="$NEW_KEY" <<'SQL'
INSERT INTO "User" (id, email, password, "firstName", "lastName", "apiKey", role, "updatedAt")
VALUES (gen_random_uuid()::text, :'email', :'hash', 'Master', 'Admin', :'apikey', 'admin', now())
ON CONFLICT (email) DO UPDATE
  SET password = EXCLUDED.password, role = 'admin', "isActive" = true, "updatedAt" = now();
SQL

echo "==> Starting Vision"
vision_compose up -d
echo "==> Done. Sign in as $MASTER_EMAIL with the master password; set other users' passwords in Users."
echo "    Jira tokens are not in backups: people enter theirs again in their profile."
