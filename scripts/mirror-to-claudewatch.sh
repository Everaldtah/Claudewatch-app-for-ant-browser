#!/usr/bin/env bash
#
# mirror-to-claudewatch.sh
#
# Mirror this repository (or just its web/ folder) to the
# Everaldtah/Claudewatch-app-for-ant-browser repo on the `main` branch.
#
# Requirements:
#   - git installed and on PATH
#   - GITHUB_TOKEN environment variable set to a PAT with `repo` scope
#
# Usage:
#   ./scripts/mirror-to-claudewatch.sh              # push the whole repo
#   ./scripts/mirror-to-claudewatch.sh --web-only   # publish only web/ as root

set -euo pipefail

TARGET_OWNER="Everaldtah"
TARGET_REPO="Claudewatch-app-for-ant-browser"
TARGET_BRANCH="main"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN is not set. Export a PAT with 'repo' scope first." >&2
  exit 1
fi

REMOTE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${TARGET_OWNER}/${TARGET_REPO}.git"

MODE="full"
if [[ "${1:-}" == "--web-only" ]]; then
  MODE="web-only"
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ "$MODE" == "web-only" ]]; then
  if [[ ! -d "$REPO_ROOT/web" ]]; then
    echo "ERROR: --web-only requested but no web/ directory exists." >&2
    exit 1
  fi
  echo "==> Publishing only web/ as the repository root"
  cp -a "$REPO_ROOT/web/." "$WORKDIR/"
else
  echo "==> Mirroring the whole repository"
  # Copy tracked + untracked (excluding .git) into a clean workdir
  rsync -a --exclude '.git' "$REPO_ROOT/" "$WORKDIR/"
fi

cd "$WORKDIR"
git init -q -b "$TARGET_BRANCH"
git add -A
git -c user.email="mirror@local" -c user.name="claudewatch-mirror" \
    commit -q -m "Mirror from source repo ($MODE)"
git remote add origin "$REMOTE_URL"

echo "==> Force-pushing to ${TARGET_OWNER}/${TARGET_REPO}:${TARGET_BRANCH}"
git push -f origin "$TARGET_BRANCH"

echo "==> Done."
