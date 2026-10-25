#!/usr/bin/env bash
# Copies the database and images of a running production VRT into the demo instance.
# Production is only read: pg_dump and a file copy. Nothing is written back.
#
# Usage: ./scripts/demo-clone-from-prod.sh [path/to/.env.demo]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.demo}"
COMPOSE=(docker compose -f "$ROOT/docker-compose.demo.yml" --env-file "$ENV_FILE")

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE. Copy .env.demo.example to .env.demo first." >&2; exit 1; }
set -a; . "$ENV_FILE"; set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vrt_demo}"
DEMO_IMAGES_DIR="$ROOT/demo-data/imageUploads"
DUMP_FILE="$ROOT/demo-data/prod.dump"
mkdir -p "$ROOT/demo-data" "$DEMO_IMAGES_DIR"

echo "==> Starting demo Postgres"
"${COMPOSE[@]}" up -d postgres
until "${COMPOSE[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do sleep 2; done

echo "==> Dumping production database"
if [ -n "${PROD_PG_CONTAINER:-}" ]; then
  # credentials come from the production container's own environment
  docker exec "$PROD_PG_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP_FILE"
elif [ -n "${PROD_DATABASE_URL:-}" ]; then
  docker run --rm --network host postgres:16-alpine pg_dump "$PROD_DATABASE_URL" -Fc > "$DUMP_FILE"
else
  echo "Set PROD_PG_CONTAINER or PROD_DATABASE_URL in $ENV_FILE" >&2; exit 1
fi
echo "    $(du -h "$DUMP_FILE" | cut -f1) dump"

echo "==> Restoring into demo database ($POSTGRES_DB)"
# Run again later, this replaces the demo data: the API stops, and the schema is emptied so
# tables of the fork's own migrations go too and the migrations apply cleanly on the next start.
"${COMPOSE[@]}" stop api ui >/dev/null 2>&1 || true
"${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
"${COMPOSE[@]}" exec -T postgres pg_restore --no-owner --no-privileges \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE" || echo "    pg_restore reported warnings (see above); the checks below tell whether the copy is usable"

# The fork's migrations continue from the squashed upstream baseline of July 2023.
# A production instance older than that has a different history and needs an upgrade first.
if ! "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "select 1 from _prisma_migrations where migration_name = '20230730154101_init'" | grep -q 1; then
  echo "!!  The copy has no 20230730154101_init migration: production VRT is older than 5.x." >&2
  echo "!!  Upgrade production first, or start the demo on an empty database." >&2
  exit 1
fi

# A production instance newer than the fork has migrations the fork does not know; the
# fork's API would then run against a schema it was not built for.
KNOWN="$(ls "$ROOT/backend/prisma/migrations" | grep -v migration_lock)"
UNKNOWN="$("${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "select migration_name from _prisma_migrations where finished_at is not null order by 1" \
  | tr -d '\r' | grep -v '^$' | grep -vxF "$KNOWN" || true)"
if [ -n "$UNKNOWN" ]; then
  echo "!!  Production has migrations this fork does not know (production VRT is newer):" >&2
  echo "$UNKNOWN" | sed 's/^/!!    /' >&2
  echo "!!  Pull the newer upstream into the fork first (git subtree pull), then run this again." >&2
  exit 1
fi
echo "    production schema: $("${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "select max(migration_name) from _prisma_migrations where finished_at is not null" | tr -d '\r')"

echo "==> Copying images"
if [ -n "${PROD_IMAGES_DIR:-}" ]; then
  # Hard links cost no space and are safe: VRT writes new files and never edits existing ones,
  # and deleting a link in the demo leaves the production file in place.
  if cp -al "$PROD_IMAGES_DIR/." "$DEMO_IMAGES_DIR/" 2>/dev/null; then
    echo "    linked (no extra space)"
  else
    rsync -a "$PROD_IMAGES_DIR/" "$DEMO_IMAGES_DIR/"
    echo "    copied"
  fi
else
  echo "    PROD_IMAGES_DIR not set, skipping (screenshots of old runs will show as missing)"
fi

echo "==> Done. Start the demo with:"
echo "    docker compose -f docker-compose.demo.yml --env-file $(basename "$ENV_FILE") up -d --build"
