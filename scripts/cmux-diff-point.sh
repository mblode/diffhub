#!/bin/bash

# Point the cmux-diff dev server at the current git repository.
# The dev server reads this file on every request — no restart needed.
#
# Setup:
#   sudo cp scripts/cmux-diff-point.sh /usr/local/bin/cmux-diff-point
#
# Usage (run from inside any git repo):
#   cmux-diff-point

REPO_POINTER="/tmp/cmux-diff-active-repo"

targetDir="$PWD"

if ! git -C "$targetDir" rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not a git repository: $targetDir" >&2
  exit 1
fi

echo "$targetDir" > "$REPO_POINTER"
echo "cmux-diff → $targetDir"
