#!/usr/bin/env bash
# =============================================================
# mirror-to-github.sh
# Push this repo (or just the web/ subtree) to a GitHub remote
# with exponential-backoff retries and automatic token scrubbing.
#
# Usage:
#   ./scripts/mirror-to-github.sh [--web-only] <github-repo-url>
#
# Env vars:
#   GITHUB_TOKEN  — optional; injected into URL for HTTPS auth
#
# Examples:
#   GITHUB_TOKEN=ghp_xxx ./scripts/mirror-to-github.sh \
#     https://github.com/Everaldtah/Claudewatch-app-for-ant-browser.git
#
#   ./scripts/mirror-to-github.sh --web-only \
#     https://github.com/Everaldtah/Claudewatch-app-for-ant-browser.git
# =============================================================
set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────
WEB_ONLY=false
REPO_URL=""

for arg in "$@"; do
  case "$arg" in
    --web-only) WEB_ONLY=true ;;
    -*)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
    *) REPO_URL="$arg" ;;
  esac
done

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 [--web-only] <github-repo-url>" >&2
  exit 1
fi

REMOTE="claudewatch-mirror"

# ── Inject GITHUB_TOKEN if set ───────────────────────────────
AUTHED_URL="$REPO_URL"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  # Replace https:// with https://x-access-token:TOKEN@
  AUTHED_URL="${REPO_URL/https:\/\//https:\/\/x-access-token:${GITHUB_TOKEN}@}"
fi

# ── Register remote ──────────────────────────────────────────
if git remote get-url "$REMOTE" &>/dev/null 2>&1; then
  git remote set-url "$REMOTE" "$AUTHED_URL"
else
  git remote add "$REMOTE" "$AUTHED_URL"
fi

# ── Scrub token from .git/config on exit ─────────────────────
cleanup() {
  local clean
  clean=$(git remote get-url "$REMOTE" 2>/dev/null \
    | sed 's|https://x-access-token:[^@]*@|https://|' \
    || echo "")
  if [[ -n "$clean" ]]; then
    git remote set-url "$REMOTE" "$clean" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Exponential-backoff push ─────────────────────────────────
push_with_retry() {
  local attempt=0
  local delays=(2 4 8 16)

  while true; do
    if "$@"; then
      return 0
    fi
    if [[ $attempt -ge ${#delays[@]} ]]; then
      echo "Push failed after $((attempt)) attempt(s). Giving up." >&2
      return 1
    fi
    local wait="${delays[$attempt]}"
    echo "Push failed. Retrying in ${wait}s… (attempt $((attempt + 1))/${#delays[@]})" >&2
    sleep "$wait"
    (( attempt++ )) || true
  done
}

# ── Push ─────────────────────────────────────────────────────
if $WEB_ONLY; then
  echo "Pushing web/ subtree → $REMOTE main …"
  push_with_retry git subtree push --prefix=web "$REMOTE" main
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "Pushing branch '$BRANCH' → $REMOTE main …"
  push_with_retry git push "$REMOTE" "${BRANCH}:main" --force-with-lease
fi

echo "Done. Token scrubbed from .git/config on exit."
