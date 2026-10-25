#!/usr/bin/env bash
# Copies the database and images of the running production VRT into Vision.
#
# Production is only read:
#   - the database by pg_dump, which runs in a read-only transaction, at the
#     lowest CPU priority (nice 19) when the production container allows it;
#   - images by reading files (copy, or hard links when PROD_IMAGES_MODE=link).
# Every write goes to Vision's own Postgres container and ./demo-data, and only
# after checking that the container is Vision's and the disk keeps a reserve
# for production (10 GB or 5 % of the disk, whichever is more; VISION_DISK_RESERVE_GB).
#
# Usage: ./scripts/demo-clone-from-prod.sh [--yes]
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"

ASSUME_YES=false
[ "${1:-}" = "--yes" ] && ASSUME_YES=true

vision_load_env
vision_guard

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vrt_demo}"
DATA_DIR="$VISION_ROOT/demo-data"
DEMO_IMAGES_DIR="$DATA_DIR/imageUploads"
DUMP_FILE="$DATA_DIR/prod.dump"
IMAGES_MODE="${PROD_IMAGES_MODE:-copy}"
mkdir -p "$DATA_DIR" "$DEMO_IMAGES_DIR"

# ---- what will be read, and how much space it needs --------------------------------

# Read-only SQL against production, as the production container's own user. The database
# is PROD_DB_NAME when set, else the container's POSTGRES_DB (the VRT default).
prod_sql() {
  if [ -n "${PROD_PG_CONTAINER:-}" ]; then
    docker exec -e VISION_PROD_DB="${PROD_DB_NAME:-}" "$PROD_PG_CONTAINER" sh -c \
      'psql -X -U "${POSTGRES_USER:-postgres}" -d "${VISION_PROD_DB:-${POSTGRES_DB:-postgres}}" -tAc "$0"' "$1"
  else
    docker run --rm --network host postgres:16-alpine psql -X "$PROD_DATABASE_URL" -tAc "$1"
  fi
}

if [ -n "${PROD_PG_CONTAINER:-}" ]; then
  docker inspect "$PROD_PG_CONTAINER" >/dev/null 2>&1 || vision_die "No container named $PROD_PG_CONTAINER (see docker ps)."
  SOURCE="container $PROD_PG_CONTAINER"
elif [ -n "${PROD_DATABASE_URL:-}" ]; then
  SOURCE="$(echo "$PROD_DATABASE_URL" | sed -E 's#(://[^:/@]+):[^@]*@#\1:***@#')"
else
  vision_die "Set PROD_PG_CONTAINER or PROD_DATABASE_URL in $VISION_ENV_FILE"
fi

PROD_DB="$(prod_sql 'select current_database()' | tr -d '[:space:]')" ||
  vision_die "Could not connect to the production database (check PROD_PG_CONTAINER / PROD_DATABASE_URL / PROD_DB_NAME)."
# the database must be VRT's: a wrong one (another app on the same server) is not copied
if [ "$(prod_sql "select (to_regclass('public.\"Project\"') is not null and to_regclass('public.\"TestRun\"') is not null and to_regclass('public.\"_prisma_migrations\"') is not null)::int" | tr -d '[:space:]')" != "1" ]; then
  echo "!!  Database \"$PROD_DB\" has no VRT tables. Databases on that server:" >&2
  prod_sql "select datname from pg_database where not datistemplate order by 1" | sed 's/^/!!    /' >&2
  vision_die "Set PROD_DB_NAME in $VISION_ENV_FILE to VRT's database (the one in production API's DATABASE_URL)."
fi
PROJECTS_SQL="$(cat <<'SQL'
select p.name || '  (' || (select count(*) from "Build" b where b."projectId" = p.id) || ' builds, '
       || (select count(*) from "TestVariation" v where v."projectId" = p.id) || ' baselines)'
from "Project" p order by p.name
SQL
)"
PROD_PROJECTS="$(prod_sql "$PROJECTS_SQL")"
PROD_PROJECT_COUNT="$(prod_sql 'select count(*) from "Project"' | tr -d '[:space:]')"
PROD_USER_COUNT="$(prod_sql 'select count(*) from "User"' | tr -d '[:space:]')"

DB_BYTES="$(prod_sql 'select pg_database_size(current_database())' | tr -d '[:space:]')"
[[ "$DB_BYTES" =~ ^[0-9]+$ ]] || vision_die "Could not read the size of the production database ($DB_BYTES)."
DB_KB=$(( DB_BYTES / 1024 ))
# the dump file plus the restored copy in Vision's Postgres, both under demo-data
vision_require_space "$DATA_DIR" $(( DB_KB * 2 )) "the database copy"

IMAGES_KB=0
if [ -n "${PROD_IMAGES_DIR:-}" ]; then
  [ -d "$PROD_IMAGES_DIR" ] || vision_die "PROD_IMAGES_DIR $PROD_IMAGES_DIR is not a folder."
  PROD_IMAGES_DIR="$(cd "$PROD_IMAGES_DIR" && pwd -P)"
  [ "$PROD_IMAGES_DIR" != "$(cd "$DEMO_IMAGES_DIR" && pwd -P)" ] ||
    vision_die "PROD_IMAGES_DIR points at Vision's own image folder. Check .env.demo."
  case "$IMAGES_MODE" in
    copy)
      IMAGES_KB="$(du -sk "$PROD_IMAGES_DIR" | awk '{print $1}')"
      ALREADY_KB="$(du -sk "$DEMO_IMAGES_DIR" | awk '{print $1}')"
      NEED_KB=$(( IMAGES_KB > ALREADY_KB ? IMAGES_KB - ALREADY_KB : 0 ))
      if [ $(( $(vision_free_kb "$DATA_DIR") - NEED_KB - DB_KB * 2 )) -lt "$(vision_reserve_kb "$DATA_DIR")" ]; then
        vision_die "Copying the images needs $(vision_human "$NEED_KB") and would leave too little disk for production. Free space, or set PROD_IMAGES_MODE=link in .env.demo (hard links: no extra space, see DEPLOY.md)."
      fi
      ;;
    link)
      [ "$(vision_fs_id "$PROD_IMAGES_DIR")" = "$(vision_fs_id "$DEMO_IMAGES_DIR")" ] ||
        vision_die "PROD_IMAGES_MODE=link needs ./demo-data on the same disk as $PROD_IMAGES_DIR. Use copy, or move the repo."
      ;;
    *) vision_die "PROD_IMAGES_MODE must be copy or link" ;;
  esac
fi

echo "Copy production VRT into Vision"
echo "  read from production:  database \"$PROD_DB\" ($SOURCE, $(vision_human "$DB_KB")), read-only, all of it:"
echo "                         $PROD_PROJECT_COUNT projects, $PROD_USER_COUNT users"
echo "$PROD_PROJECTS" | sed 's/^/                           - /'
[ -n "${PROD_IMAGES_DIR:-}" ] &&
  echo "                         images  ($PROD_IMAGES_DIR, $IMAGES_MODE$( [ "$IMAGES_MODE" = copy ] && echo ", $(vision_human "$IMAGES_KB")"))"
echo "  replaced in Vision:    its database and ./demo-data/imageUploads (Vision's API stops meanwhile)"
echo "  production is not written to and keeps running."
if ! $ASSUME_YES; then
  read -r -p "Type yes to continue: " answer
  [ "$answer" = "yes" ] || { echo "Nothing done."; exit 0; }
fi

# ---- copy ----------------------------------------------------------------------------

echo "==> Starting Vision's Postgres"
vision_compose up -d postgres
until vision_compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do sleep 2; done
DEMO_PG="$(vision_container postgres)"
[ -n "$DEMO_PG" ] || vision_die "Vision's Postgres did not start."
[ "$DEMO_PG" != "$(docker inspect -f '{{.Id}}' "${PROD_PG_CONTAINER:-none}" 2>/dev/null || true)" ] ||
  vision_die "Vision's Postgres and production's are the same container. Nothing was done."

echo "==> Dumping production database (read-only)"
if [ -n "${PROD_PG_CONTAINER:-}" ]; then
  # credentials come from the production container's own environment
  docker exec -e VISION_PROD_DB="$PROD_DB" "$PROD_PG_CONTAINER" sh -c \
    'set -- pg_dump -U "${POSTGRES_USER:-postgres}" -d "$VISION_PROD_DB" -Fc; if command -v nice >/dev/null; then exec nice -n 19 "$@"; else exec "$@"; fi' \
    > "$DUMP_FILE.part"
else
  docker run --rm --network host postgres:16-alpine nice -n 19 pg_dump "$PROD_DATABASE_URL" -Fc > "$DUMP_FILE.part"
fi
mv "$DUMP_FILE.part" "$DUMP_FILE"
echo "    $(du -h "$DUMP_FILE" | cut -f1) dump"

echo "==> Restoring into Vision's database ($POSTGRES_DB)"
# Run again later, this replaces Vision's data: the API stops, and the schema is emptied
# so tables of the fork's own migrations go too and apply cleanly on the next start.
vision_compose stop api ui >/dev/null 2>&1 || true
docker exec -i "$DEMO_PG" psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
docker exec -i "$DEMO_PG" pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE" ||
  echo "    pg_restore reported warnings (see above); the checks below tell whether the copy is usable"

demo_sql() {
  docker exec -i "$DEMO_PG" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1" | tr -d '\r'
}

# The fork's migrations continue from the squashed upstream baseline of July 2023.
if ! demo_sql "select 1 from _prisma_migrations where migration_name = '20230730154101_init'" | grep -q 1; then
  vision_die "The copy has no 20230730154101_init migration: production VRT is older than 5.x. Upgrade production first, or start Vision on an empty database."
fi
# A production newer than the fork has migrations the fork does not know.
KNOWN="$(ls "$VISION_ROOT/backend/prisma/migrations" | grep -v migration_lock)"
UNKNOWN="$(demo_sql "select migration_name from _prisma_migrations where finished_at is not null order by 1" |
  grep -v '^$' | grep -vxF "$KNOWN" || true)"
if [ -n "$UNKNOWN" ]; then
  echo "!!  Production has migrations this fork does not know (production VRT is newer):" >&2
  echo "$UNKNOWN" | sed 's/^/!!    /' >&2
  vision_die "Pull the newer upstream into the fork first (git subtree pull), then run this again."
fi
echo "    production schema: $(demo_sql "select max(migration_name) from _prisma_migrations where finished_at is not null")"
COPIED_PROJECTS="$(demo_sql 'select count(*) from "Project"' | tr -d '[:space:]')"
COPIED_USERS="$(demo_sql 'select count(*) from "User"' | tr -d '[:space:]')"
[ "$COPIED_PROJECTS" = "$PROD_PROJECT_COUNT" ] && [ "$COPIED_USERS" = "$PROD_USER_COUNT" ] ||
  vision_die "The copy has $COPIED_PROJECTS projects and $COPIED_USERS users, production $PROD_PROJECT_COUNT and $PROD_USER_COUNT. See the pg_restore messages above."
echo "    copied: $COPIED_PROJECTS projects, $COPIED_USERS users"

echo "==> Images"
if [ -n "${PROD_IMAGES_DIR:-}" ]; then
  if [ "$IMAGES_MODE" = link ]; then
    # Hard links cost no space and are safe: Vision writes new files only, never into an
    # existing one, and deleting a link in Vision leaves the production file in place.
    if command -v rsync >/dev/null; then
      rsync -a --link-dest="$PROD_IMAGES_DIR/" "$PROD_IMAGES_DIR/" "$DEMO_IMAGES_DIR/"
    else
      cp -aln "$PROD_IMAGES_DIR/." "$DEMO_IMAGES_DIR/"
    fi
    echo "    linked (no extra space)"
  else
    if command -v rsync >/dev/null; then
      rsync -a "$PROD_IMAGES_DIR/" "$DEMO_IMAGES_DIR/"
    else
      cp -a "$PROD_IMAGES_DIR/." "$DEMO_IMAGES_DIR/"
    fi
    echo "    copied"
  fi
else
  echo "    PROD_IMAGES_DIR not set, skipping (screenshots of old runs will show as missing)"
fi

echo "==> Done. Start Vision with:"
echo "    ./scripts/vision.sh up -d --build"
