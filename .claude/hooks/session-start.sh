#!/bin/bash
# SessionStart hook: a cloud session starts from a fresh clone without node_modules,
# so tests, tsc, eslint and Playwright would fail until someone installs them by hand.
# Local machines keep their own node_modules; the hook does nothing there.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
hook="$root/.claude/hooks/session-start.sh"

for package in backend frontend; do
  cd "$root/$package"
  # Install only when the lockfile or this script changed since the last good install:
  # the hook also runs on resume, clear and compact, and holds the session while it works.
  hashes=node_modules/.session-start.sha256
  if ! sha256sum --check --status "$hashes" 2>/dev/null; then
    rm -f "$hashes"
    # npm ci, not npm install: it never rewrites package-lock.json, so git status stays clean.
    # In backend its postinstall also runs prisma generate.
    npm ci --no-audit --no-fund >&2
    sha256sum "$hook" package.json package-lock.json > "$hashes"
  fi
done

# The cloud image has its own Chromium; `playwright install` must not replace it,
# so frontend/playwright.config.ts launches this one when the variable is set.
cloud_chromium=/opt/pw-browsers/chromium
if [ -x "$cloud_chromium" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE=$cloud_chromium" >> "$CLAUDE_ENV_FILE"
fi
