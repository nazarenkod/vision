#!/usr/bin/env bash
# After the new Vision started on a fresh copy of production VRT: compares what Vision holds with
# production, and checks what the first start had to do (docs/security/bank-readiness-plan.md,
# «Перехід на нову версію», step 5).
#
# Both databases are only read: counts and checks with SELECT. Production keeps working while
# this runs, so it may already hold more than the copy; that is reported, not a problem.
# Exits 1 when something must be fixed before people start working.
#
# Usage: ./scripts/vision-check-cutover.sh
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib/vision-safety.sh"

vision_load_env
vision_guard

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vision}"
API_URL="${DEMO_API_URL:-http://localhost:${DEMO_API_PORT:-14200}}"

PG="$(vision_container postgres)"
[ -n "$PG" ] || vision_die "Vision's Postgres is not running: start Vision first (./scripts/vision.sh up -d)."

vision_sql() {
  docker exec "$PG" psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1" | tr -d '[:space:]'
}
prod_sql() {
  vision_prod_sql "$1" | tr -d '[:space:]'
}

PROBLEMS=0
problem() {
  echo "!!  $*"
  PROBLEMS=$((PROBLEMS + 1))
}

echo "==> API at $API_URL"
if curl -fs "$API_URL/health" >/dev/null 2>&1; then
  echo "    answers /health"
else
  problem "the API does not answer $API_URL/health: see ./scripts/vision.sh logs api"
fi

echo "==> Migrations"
LATEST="$(ls "$VISION_ROOT/backend/prisma/migrations" | grep -E '^[0-9]{14}_' | sort | tail -1)"
APPLIED="$(vision_sql "select count(*) as latest_applied from _prisma_migrations where migration_name = '$LATEST' and finished_at is not null")"
if [ "$APPLIED" = "1" ]; then
  echo "    applied up to $LATEST"
else
  problem "$LATEST is not applied: see ./scripts/vision.sh logs migration"
fi

echo "==> Rows                production VRT    Vision"
for table in Project Build TestVariation Baseline TestRun User; do
  in_prod="$(prod_sql "select count(*) from \"$table\"")"
  in_vision="$(vision_sql "select count(*) from \"$table\"")"
  note=""
  if [ "$in_vision" = "$in_prod" ]; then
    note="same"
  elif [ "${in_vision:-0}" -eq 0 ] && [ "${in_prod:-0}" -gt 0 ]; then
    problem "\"$table\" is empty in Vision: the copy did not get there (./scripts/demo-clone-from-prod.sh)"
    note="missing"
  elif [ "$in_vision" -lt "$in_prod" ]; then
    note="production has $((in_prod - in_vision)) more since the copy"
  else
    note="Vision has $((in_vision - in_prod)) more, made after the copy"
  fi
  printf '    %-18s %14s %9s   %s\n' "$table" "$in_prod" "$in_vision" "$note"
done

echo "==> First start of this version"
PLAIN_KEYS="$(vision_sql "select count(*) as plain_keys from \"User\" where \"apiKey\" not like 'sha256:%'")"
[ "$PLAIN_KEYS" = "0" ] && echo "    no API key from VRT works here" ||
  problem "$PLAIN_KEYS API key(s) are stored readable: the API has not finished its first start"
PLAIN_SECRETS="$(vision_sql "select count(*) as plain_secrets from \"User\" where (coalesce(\"jiraToken\", '') <> '' and \"jiraToken\" not like 'enc:v1:%') or (coalesce(\"geminiApiKey\", '') <> '' and \"geminiApiKey\" not like 'enc:v1:%')")"
[ "$PLAIN_SECRETS" = "0" ] && echo "    Jira tokens and Gemini keys are sealed" ||
  problem "$PLAIN_SECRETS person(s) have a readable Jira token or Gemini key: is VISION_SECRET_KEY set?"
WITHOUT_ACCESS="$(vision_sql "select count(*) as without_access from \"User\" u where u.role <> 'admin' and not exists (select 1 from \"ProjectAccess\" a where a.\"userId\" = u.id)")"
[ "$WITHOUT_ACCESS" = "0" ] && echo "    everyone sees their projects, as in VRT" ||
  echo "    $WITHOUT_ACCESS person(s) see no project: an admin gives access in a project's settings"
if [ -z "${VISION_JIRA_HOSTS:-}" ]; then
  echo "    VISION_JIRA_HOSTS is empty: Vision calls no Jira until it lists the bank's Jira host"
fi

if [ "$PROBLEMS" -gt 0 ]; then
  vision_die "$PROBLEMS problem(s) above. Production was only read; fix them, or roll back (DEPLOY.md)."
fi
echo "==> Vision is ready. Next: everyone makes a new API key in their profile and puts it in CI."
