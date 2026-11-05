#!/usr/bin/env bash
# Exports the code at a commit as a new repository with one commit and no history
# (docs/security/bank-readiness-plan.md, 3.6), for moving Vision into the bank's own git.
#
# Only reads this repository: the export is `git archive` of a commit, so only tracked files go,
# never .env files, demo-data or local settings. Nothing is pushed anywhere; where the new
# repository goes is the owner's decision.
#
# Usage: ./scripts/export-without-history.sh <empty-or-new-folder> [commit, default HEAD]
set -euo pipefail

TARGET="${1:-}"
COMMIT="${2:-HEAD}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

die() {
  echo "!!  $*" >&2
  exit 1
}

[ -n "$TARGET" ] || die "Usage: $0 <empty-or-new-folder> [commit]"
git -C "$ROOT" rev-parse --verify --quiet "$COMMIT^{commit}" >/dev/null || die "No commit $COMMIT."
if [ "$COMMIT" = "HEAD" ] && [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  die "There are uncommitted changes: commit them, or name the commit to export."
fi
if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET")" ]; then
  die "$TARGET is not empty. Nothing was written."
fi
case "$(cd "$(dirname "$TARGET")" 2>/dev/null && pwd)/" in
  "$ROOT"/*) die "$TARGET is inside this repository: choose a folder outside it." ;;
esac

SHA="$(git -C "$ROOT" rev-parse "$COMMIT")"
mkdir -p "$TARGET"
echo "==> Exporting $SHA into $TARGET"
git -C "$ROOT" archive --format=tar "$SHA" | tar -x -C "$TARGET"

git -C "$TARGET" init -q
git -C "$TARGET" symbolic-ref HEAD refs/heads/main
git -C "$TARGET" add -A
VERSION="$(sed -n 's/^version = .\(.*\).$/\1/p' "$TARGET/sdk-java/build.gradle" | head -1)"
git -C "$TARGET" -c user.name="$(git -C "$ROOT" config user.name || echo Vision)" \
  -c user.email="$(git -C "$ROOT" config user.email || echo vision@localhost)" \
  commit -q -m "Vision${VERSION:+ $VERSION}" -m "Exported without history (scripts/export-without-history.sh)."

echo "==> One commit, $(git -C "$TARGET" ls-files | wc -l | tr -d ' ') files. No remote is set; nothing was pushed."
