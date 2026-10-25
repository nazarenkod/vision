# Shared by scripts/vision.sh and scripts/demo-clone-from-prod.sh.
#
# Vision runs on the same host as the production VRT. Both are compose projects
# with the same service names (postgres, api, ui, migration), so a compose
# command aimed at the wrong project would stop or wipe production. Everything
# here exists to make that impossible:
#   - the project name is fixed and never taken from COMPOSE_PROJECT_NAME;
#   - before any command, every container of that project must have been
#     created from this repo's compose file, or nothing runs;
#   - the production database container may never belong to the project.

VISION_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
VISION_PROJECT="vision"
VISION_COMPOSE_FILE="$VISION_ROOT/docker-compose.demo.yml"
VISION_ENV_FILE="${VISION_ENV_FILE:-$VISION_ROOT/.env.demo}"
# a COMPOSE_PROJECT_NAME left in the shell (e.g. production's) must not apply
unset COMPOSE_PROJECT_NAME COMPOSE_FILE

vision_die() {
  echo "!!  $*" >&2
  exit 1
}

vision_compose() {
  docker compose -p "$VISION_PROJECT" -f "$VISION_COMPOSE_FILE" --env-file "$VISION_ENV_FILE" "$@"
}

vision_load_env() {
  [ -f "$VISION_ENV_FILE" ] || vision_die "No $VISION_ENV_FILE. Copy .env.demo.example to .env.demo and fill it in first."
  set -a
  # shellcheck disable=SC1090
  . "$VISION_ENV_FILE"
  set +a
}

# Every container labelled with the project must come from this compose file.
vision_guard() {
  command -v docker >/dev/null || vision_die "docker not found"
  docker info >/dev/null 2>&1 || vision_die "Docker is not running or not reachable"
  local foreign
  foreign="$(docker ps -a --filter "label=com.docker.compose.project=$VISION_PROJECT" \
    --format '{{.Names}}|{{.Label "com.docker.compose.project.config_files"}}' |
    while IFS='|' read -r name files; do
      [ -z "$name" ] && continue
      [[ ",$files," == *",$VISION_COMPOSE_FILE,"* ]] || echo "$name, from ${files:-unknown}"
    done)"
  if [ -n "$foreign" ]; then
    echo "!!  The compose project \"$VISION_PROJECT\" has containers that were not created from" >&2
    echo "!!  $VISION_COMPOSE_FILE:" >&2
    echo "$foreign" | sed 's/^/!!    /' >&2
    echo "!!  They may be another installation or production itself. Nothing was done." >&2
    exit 1
  fi
  if [ -n "${PROD_PG_CONTAINER:-}" ] && docker inspect "$PROD_PG_CONTAINER" >/dev/null 2>&1; then
    local project
    project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$PROD_PG_CONTAINER")"
    [ "$project" != "$VISION_PROJECT" ] ||
      vision_die "PROD_PG_CONTAINER ($PROD_PG_CONTAINER) belongs to the Vision project itself. Check .env.demo."
  fi
}

# Container id of a Vision service, after checking it really is Vision's.
vision_container() {
  local id files
  id="$(vision_compose ps -q "$1" 2>/dev/null | head -1)"
  [ -n "$id" ] || return 0
  files="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$id")"
  [[ ",$files," == *",$VISION_COMPOSE_FILE,"* ]] ||
    vision_die "Service $1 is not Vision's own container ($files). Nothing was done."
  echo "$id"
}

# Free space in KB on the filesystem holding a path.
vision_free_kb() {
  df -Pk "$1" | awk 'NR==2 {print $4}'
}

vision_total_kb() {
  df -Pk "$1" | awk 'NR==2 {print $2}'
}

# What must stay free on a filesystem shared with production: 10 GB or 5 % of the
# disk, whichever is more, or VISION_DISK_RESERVE_GB when set.
vision_reserve_kb() {
  if [ -n "${VISION_DISK_RESERVE_GB:-}" ]; then
    echo $(( VISION_DISK_RESERVE_GB * 1024 * 1024 ))
    return
  fi
  local share=$(( $(vision_total_kb "$1") * 5 / 100 ))
  local floor=$(( 10 * 1024 * 1024 ))
  [ "$share" -gt "$floor" ] && echo "$share" || echo "$floor"
}

vision_human() {
  awk -v kb="$1" 'BEGIN { if (kb >= 1048576) printf "%.1f GB", kb/1048576; else printf "%.0f MB", kb/1024 }'
}

# Refuses when writing need_kb to path would leave less than the reserve free.
vision_require_space() {
  local path="$1" need_kb="$2" what="$3"
  local free reserve
  free="$(vision_free_kb "$path")"
  reserve="$(vision_reserve_kb "$path")"
  if [ $(( free - need_kb )) -lt "$reserve" ]; then
    vision_die "Not enough disk for $what: needs $(vision_human "$need_kb"), $(vision_human "$free") free on $(df -P "$path" | awk 'NR==2 {print $6}'), and $(vision_human "$reserve") must stay free for production. Free some space first."
  fi
}

vision_fs_id() {
  stat -c %d "$1" 2>/dev/null || stat -f %d "$1"
}
