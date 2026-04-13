#!/bin/bash

# Point the diffr dev server at the current git repository.
# The dev server reads this file on every request — no restart needed.
#
# Setup:
#   sudo cp scripts/diffr-point.sh /usr/local/bin/diffr-point
#
# Usage (run from inside any git repo):
#   diffr-point

REPO_POINTER="/tmp/diffr-active-repo"

targetDir="$PWD"

if ! git -C "$targetDir" rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not a git repository: $targetDir" >&2
  exit 1
fi

echo "$targetDir" > "$REPO_POINTER"
echo "diffr → $targetDir"
