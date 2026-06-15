#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
DRAFTS_FLAG=""

for arg in "$@"; do
  case "$arg" in
    --drafts) DRAFTS_FLAG="--drafts" ;;
    *) echo "unknown option: $arg"; exit 1 ;;
  esac
done

echo "Building site${DRAFTS_FLAG:+ (with drafts)}..."
cd "$REPO_ROOT"
npm install --silent
node scripts/build.js $DRAFTS_FLAG

echo "Serving on http://localhost:${PORT}"
exec python3 -m http.server "$PORT" --directory public
