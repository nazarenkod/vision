#!/usr/bin/env bash
# Control scenario: the whole working path of Vision against a real server, compared with a
# recorded reference. Every later change (upgrades, renames, new access rules) must keep it
# green, or change the reference together with its specification.
#
#   ./scripts/control-scenario.sh            compare with the reference
#   ./scripts/control-scenario.sh --update   record the reference anew (only when behaviour changed on purpose)
#   ./scripts/control-scenario.sh --images   the same against the Docker images (api, migration) built from here
#   CONTROL_ONLY=<file pattern>               run one test file of backend/test_control
#   CONTROL_LOG_DIR=<folder>                  keep the API log of the run there
#
# What runs, and what it touches:
#   - a throwaway Postgres in its own container "vision-control-pg-<pid>": no volumes (tmpfs),
#     bound to 127.0.0.1 only, removed on exit. Neither production's nor Vision's database is used;
#   - the backend built from this checkout (dist/), started from a temporary folder, so its
#     images land there and no .env of this repo is read; with --images, the api and migration
#     images instead, in a network of their own ("vision-control-net-<pid>"), as the host user;
#   - the Java SDK built from sdk-java/ and the CLI from frontend/public/cli/vision.py;
#   - a fake Jira inside the test (backend/test_control/), which records what Vision sends.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"
vision_docker_path

UPDATE=false
IMAGES=false
for arg in "$@"; do
  [ "$arg" = "--update" ] && UPDATE=true
  [ "$arg" = "--images" ] && IMAGES=true
done

BACKEND="$VISION_ROOT/backend"
SDK="$VISION_ROOT/sdk-java"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/vision-control.XXXXXX")"
PG_NAME="vision-control-pg-$$"
API_NAME="vision-control-api-$$"
NET_NAME="vision-control-net-$$"
API_PID=""

free_port() {
  python3 -I -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if $IMAGES; then
    docker logs "$API_NAME" >"$WORK/api.log" 2>&1 || true
  fi
  # CONTROL_LOG_DIR keeps the API log of the run, for looking into a failure
  [ -n "${CONTROL_LOG_DIR:-}" ] && [ -f "$WORK/api.log" ] && cp "$WORK/api.log" "$CONTROL_LOG_DIR/" || true
  # only what this run created, by exact name: the containers, then their network
  docker stop "$API_NAME" "$PG_NAME" >/dev/null 2>&1 || true
  if $IMAGES; then docker network rm "$NET_NAME" >/dev/null 2>&1 || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

command -v docker >/dev/null || vision_die "Docker is needed for the throwaway Postgres."
command -v java >/dev/null || vision_die "Java 11+ is needed for the SDK."
[ -d "$BACKEND/node_modules" ] || vision_die "No backend/node_modules: run npm ci in backend first."
if docker inspect "$PG_NAME" >/dev/null 2>&1; then
  vision_die "A container named $PG_NAME already exists; not touching it."
fi

PG_PORT="$(free_port)"
API_PORT="$(free_port)"
DB_URL="postgresql://control:control@127.0.0.1:$PG_PORT/control?schema=public"

NETWORK_ARGS=()
if $IMAGES; then
  docker network create "$NET_NAME" >/dev/null
  # the migration image waits for "postgres", as in compose
  NETWORK_ARGS=(--network "$NET_NAME" --network-alias postgres)
fi
echo "==> Throwaway Postgres $PG_NAME on 127.0.0.1:$PG_PORT"
docker run -d --rm --name "$PG_NAME" ${NETWORK_ARGS[@]+"${NETWORK_ARGS[@]}"} --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=control -e POSTGRES_PASSWORD=control -e POSTGRES_DB=control \
  -p "127.0.0.1:$PG_PORT:5432" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$PG_NAME" pg_isready -U control -d control >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG_NAME" pg_isready -U control -d control >/dev/null || vision_die "Postgres did not start."

# the seeded admin, as the migration container creates it in production
export DATABASE_URL="$DB_URL"
export DEFAULT_USER_EMAIL="admin@control.test"
export DEFAULT_USER_PASSWORD="control-admin-password"
export DEFAULT_USER_API_KEY="CONTROLADMINAPIKEY000000000000"

if $IMAGES; then
  vision_builder
  echo "==> Building the api and migration images"
  docker build -q -t vision-control-api "$BACKEND" >"$WORK/build.log" 2>&1 || { cat "$WORK/build.log"; vision_die "api image failed."; }
  docker build -q -t vision-control-migration "$BACKEND/prisma" >"$WORK/build.log" 2>&1 || { cat "$WORK/build.log"; vision_die "migration image failed."; }
  echo "==> Migrations and seed (migration image)"
  docker run --rm --network "$NET_NAME" -e DATABASE_URL="postgresql://control:control@postgres:5432/control?schema=public" \
    -e DEFAULT_USER_EMAIL -e DEFAULT_USER_PASSWORD -e DEFAULT_USER_API_KEY vision-control-migration >"$WORK/migrate.log" 2>&1 ||
    { cat "$WORK/migrate.log"; vision_die "Migrations failed."; }
else
echo "==> Migrations and seed"
(cd "$BACKEND" && npx prisma migrate deploy >"$WORK/migrate.log" 2>&1) || { cat "$WORK/migrate.log"; vision_die "Migrations failed."; }
(cd "$BACKEND" && npx ts-node prisma/seed.ts >"$WORK/seed.log" 2>&1) || { cat "$WORK/seed.log"; vision_die "Seed failed."; }

echo "==> Building the backend"
(cd "$BACKEND" && npm run build >"$WORK/build.log" 2>&1) || { cat "$WORK/build.log"; vision_die "Backend build failed."; }
# The image builds src alone (dist/main.js); a checkout also has the test_* folders next to it,
# which moves the output one level down.
MAIN_JS="$BACKEND/dist/main.js"
[ -f "$MAIN_JS" ] || MAIN_JS="$BACKEND/dist/src/main.js"
[ -f "$MAIN_JS" ] || vision_die "No main.js in backend/dist after the build."
fi

echo "==> Building the SDK"
cat >"$WORK/classpath.gradle" <<'GRADLE'
allprojects {
  afterEvaluate {
    tasks.register('controlClasspath') {
      dependsOn 'jar'
      doLast { println "CLASSPATH=" + (jar.archiveFile.get().asFile.path + File.pathSeparator + sourceSets.main.runtimeClasspath.asPath) }
    }
  }
}
GRADLE
SDK_CP="$(cd "$SDK" && gradle -q --offline --no-daemon -I "$WORK/classpath.gradle" controlClasspath 2>"$WORK/sdk.log" | sed -n 's/^CLASSPATH=//p')" ||
  { cat "$WORK/sdk.log"; vision_die "SDK build failed."; }
[ -n "$SDK_CP" ] || { cat "$WORK/sdk.log"; vision_die "SDK build gave no classpath."; }

echo "==> Starting the API on 127.0.0.1:$API_PORT"
mkdir -p "$WORK/api"
if $IMAGES; then
  # as compose runs it: the host user, images in a mounted folder; the fake Jira is on the host
  docker run -d --rm --name "$API_NAME" --network "$NET_NAME" --user "$(id -u):$(id -g)" \
    -p "127.0.0.1:$API_PORT:3000" -v "$WORK/api:/imageUploads" --add-host host.docker.internal:host-gateway \
    -e DATABASE_URL="postgresql://control:control@postgres:5432/control?schema=public" \
    -e JWT_SECRET="control-jwt-secret" -e JWT_LIFE_TIME="1d" -e APP_FRONTEND_URL="http://vision.control.test" \
    -e BODY_PARSER_JSON_LIMIT="20mb" -e TZ="UTC" vision-control-api >/dev/null
else
(
  cd "$WORK/api"
  env -i PATH="$PATH" HOME="$WORK/api" DATABASE_URL="$DB_URL" APP_PORT="$API_PORT" \
    JWT_SECRET="control-jwt-secret" JWT_LIFE_TIME="1d" APP_FRONTEND_URL="http://vision.control.test" \
    BODY_PARSER_JSON_LIMIT="20mb" TZ="UTC" \
    node "$MAIN_JS" >"$WORK/api.log" 2>&1
) &
API_PID=$!
fi
for _ in $(seq 1 90); do
  curl -fs "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && break
  if $IMAGES; then
    docker inspect "$API_NAME" >/dev/null 2>&1 || vision_die "The API container exited."
  else
    kill -0 "$API_PID" 2>/dev/null || { cat "$WORK/api.log"; vision_die "The API exited."; }
  fi
  sleep 1
done
curl -fs "http://127.0.0.1:$API_PORT/health" >/dev/null || { cat "$WORK/api.log"; vision_die "The API did not answer /health."; }

echo "==> Scenario"
JEST_ARGS=(--projects test_control --runInBand ${CONTROL_ONLY:+--testPathPatterns "$CONTROL_ONLY"})
$UPDATE && JEST_ARGS+=(--updateSnapshot) || JEST_ARGS+=(--ci)
set +e
(
  cd "$BACKEND"
  CONTROL_API="http://127.0.0.1:$API_PORT" CONTROL_SDK_CLASSPATH="$SDK_CP" CONTROL_WORK="$WORK" \
    CONTROL_CLI="$VISION_ROOT/frontend/public/cli/vision.py" CONTROL_FIXTURES="$BACKEND/src/ui-tree/__fixtures__" \
    CONTROL_ADMIN_EMAIL="$DEFAULT_USER_EMAIL" CONTROL_ADMIN_PASSWORD="$DEFAULT_USER_PASSWORD" \
    CONTROL_JIRA_HOST="$($IMAGES && echo host.docker.internal || echo 127.0.0.1)" \
    node --experimental-vm-modules node_modules/jest/bin/jest.js "${JEST_ARGS[@]}"
)
status=$?
set -e
if [ $status -ne 0 ]; then
  if $IMAGES; then docker logs "$API_NAME" >"$WORK/api.log" 2>&1; fi
  echo "---- last lines of the API log ----"
  tail -n 40 "$WORK/api.log"
fi
exit $status
