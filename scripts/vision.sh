#!/usr/bin/env bash
# docker compose for Vision, and only for Vision. Use it for every command:
#
#   ./scripts/vision.sh up -d --build
#   ./scripts/vision.sh ps -a
#   ./scripts/vision.sh logs migration
#   ./scripts/vision.sh down
#
# It refuses to run when the "vision" compose project holds containers not made
# from this repo's compose file (another install, or production by mistake).
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"

vision_load_env
vision_guard

# Building images takes several GB on the Docker data disk, which production uses too.
if printf '%s\n' "$@" | grep -qxE 'build|--build'; then
  root="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || true)"
  if [ -n "$root" ] && [ -d "$root" ]; then
    vision_require_space "$root" $(( 6 * 1024 * 1024 )) "building the images"
  else
    echo "    (cannot check free space of the Docker data dir; make sure 6 GB are free there)"
  fi
fi

vision_compose "$@"
