#!/bin/bash

# =============================================================================
# open-in-diffhub.sh
# Open diffhub in a cmux browser split pane for the current git repository.
#
# Dependencies:
#   - cmux  https://cmux.app/
#
# Configure the project path (add to ~/.zshrc):
#   export DIFFHUB_PROJECT="/path/to/diffhub"
#
# Setup:
#   sudo cp scripts/open-in-diffhub.sh /usr/local/bin/diffhub-open
#
# Usage (run from inside any git repo):
#   diffhub-open
#   diffhub-open --base develop
#   diffhub-open --port 3000
# =============================================================================

CMUX="/Applications/cmux.app/Contents/Resources/bin/cmux"
BASE_BRANCH=""
PROJECT_DIR="${DIFFHUB_PROJECT:-/Users/mblode/Code/mblode/cmux-diff}"
CLI_DIR="$PROJECT_DIR/apps/cli"
BIN="$CLI_DIR/bin/diffhub.mjs"
NPM="$(command -v npm)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_BRANCH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

targetDir="$PWD"

# Derive a consistent port from the repo path so each worktree gets its own server
HASH=$(printf '%s' "$targetDir" | cksum | awk '{print $1 % 10000}')
PORT=$(( 20000 + HASH ))

if ! git -C "$targetDir" rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not a git repository: $targetDir" >&2
  exit 1
fi

kill_server() {
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null
}

# Always kill any existing server so the new repo is picked up
lsof -ti:"$PORT" | xargs kill -9 2>/dev/null

# Start the server fresh for this repo
if true; then

  # Build if no production build exists
  if [[ ! -d "$CLI_DIR/.next" ]]; then
    echo "No build found — running npm run build..."
    "$CMUX" notify --title "diffhub" --body "Building... (first run only)"
    "$NPM" run build --prefix "$PROJECT_DIR" > /tmp/diffhub-build.log 2>&1
    if [[ $? -ne 0 ]]; then
      echo "Error: Build failed. See /tmp/diffhub-build.log" >&2
      "$CMUX" notify --title "diffhub" --body "Build failed — check /tmp/diffhub-build.log"
      exit 1
    fi
    echo "Build complete."
  fi

  "$CMUX" notify --title "diffhub" --body "Starting server..."

  DIFFHUB_REPO="$targetDir" \
    ${BASE_BRANCH:+DIFFHUB_BASE="$BASE_BRANCH"} \
    node "$BIN" --no-open --port "$PORT" --repo "$targetDir" \
    ${BASE_BRANCH:+--base "$BASE_BRANCH"} \
    > /tmp/diffhub-server.log 2>&1 &

  trap kill_server EXIT INT TERM

  echo "Waiting for server on port $PORT..."
  for i in $(seq 1 40); do
    if curl -s "http://localhost:$PORT/" > /dev/null 2>&1; then
      echo "Server ready."
      break
    fi
    if [[ $i -eq 40 ]]; then
      echo "Error: Server did not start in 20 seconds. See /tmp/diffhub-server.log" >&2
      "$CMUX" notify --title "diffhub" --body "Server failed to start"
      exit 1
    fi
    sleep 0.5
  done

fi

"$CMUX" notify --title "diffhub" --body "Opening diff: $targetDir"

cmuxOut=$("$CMUX" --json browser open-split "http://localhost:$PORT/" 2>&1)

browserSurface=$(echo "$cmuxOut" \
  | grep -o '"surface_ref" *: *"surface:[^"]*"' \
  | grep -o 'surface:[0-9]*')

if [[ -z "$browserSurface" ]]; then
  echo "Browser opened (surface tracking unavailable)"
  wait
  exit 0
fi

echo "Opened surface $browserSurface — waiting for it to close..."
while "$CMUX" surface-health 2>&1 | grep -q "$browserSurface"; do
  sleep 1
done

kill_server
