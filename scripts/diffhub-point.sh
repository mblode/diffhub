#!/bin/bash

# Point the diffhub dev server at the current git repository.
# The dev server reads this file on every request — no restart needed.
#
# Setup:
#   sudo cp scripts/diffhub-point.sh /usr/local/bin/diffhub-point
#
# Usage (run from inside any git repo):
#   diffhub-point

REPO_POINTER="/tmp/diffhub-active-repo"

targetDir="$PWD"

if ! git -C "$targetDir" rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not a git repository: $targetDir" >&2
  exit 1
fi

echo "$targetDir" > "$REPO_POINTER"
echo "diffhub → $targetDir"
