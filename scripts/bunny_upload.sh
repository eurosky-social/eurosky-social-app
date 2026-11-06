#!/usr/bin/env bash
# Eurosky fork: upload the static web build to a Bunny.net Edge Storage zone.
#
# Reads from the environment (or ./.env if not already set):
#   BUNNY_STORAGE_ZONE      full base URL incl. zone name, e.g.
#                           https://storage.bunnycdn.com/eurosky-app
#   BUNNY_STORAGE_PASSWORD  storage zone password (sent as the AccessKey header)
# Optional, to purge the pull zone afterwards:
#   BUNNY_API_KEY           account-level API key
#   BUNNY_PULLZONE_ID       numeric pull zone id
#   BUNNY_PUBLIC_URL        site the pull zone serves; when set, purging repeats
#                           until it serves this build (see below)
#   BUNNY_EDGE_WAIT_SECONDS how long to wait for that (default 600)
#
# Usage: ./bunny_upload.sh [build-dir]     (default: web-build)
#
# It does not delete stale objects. Hashed assets are immutable so leftover
# old chunks are harmless; index.html overwrites in place.
set -euo pipefail

DIR="${1:-web-build}"

# Load .env only if the vars aren't already provided by the environment (CI).
if [[ -z "${BUNNY_STORAGE_ZONE:-}" || -z "${BUNNY_STORAGE_PASSWORD:-}" ]]; then
  if [[ -f .env ]]; then
    set -a; . ./.env; set +a
  fi
fi
: "${BUNNY_STORAGE_ZONE:?set BUNNY_STORAGE_ZONE}"
: "${BUNNY_STORAGE_PASSWORD:?set BUNNY_STORAGE_PASSWORD}"

BASE="${BUNNY_STORAGE_ZONE%/}" # strip any trailing slash
[[ -d "$DIR" ]] || { echo "no $DIR/ - build first (./scripts/bunny_build.sh)"; exit 1; }

total=$(find "$DIR" -type f | wc -l | tr -d ' ')
echo "Uploading $total files from $DIR/ -> $BASE ..."

export BASE BUNNY_STORAGE_PASSWORD DIR

# Upload a single file; print only on failure. Bunny returns 201 on success.
upload_one() {
  local file="$1"
  local rel="${file#"$DIR"/}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
    "$BASE/$rel" \
    -H "AccessKey: $BUNNY_STORAGE_PASSWORD" \
    --data-binary @"$file") || { echo "ERR   $rel (curl failed)"; return 1; }
  if [[ "$code" != "201" && "$code" != "200" ]]; then
    echo "FAIL  $code  $rel"
    return 1
  fi
}
export -f upload_one

fails=0
find "$DIR" -type f -print0 \
  | xargs -0 -P 8 -I{} bash -c 'upload_one "$@"' _ {} \
  || fails=1

if [[ "$fails" != "0" ]]; then
  echo "Completed WITH ERRORS (see FAIL/ERR lines above)." >&2
  exit 1
fi
echo "Done: uploaded $total files to $BASE"

# Optional: purge the pull zone cache so the new build is served immediately.
# Needs the account-level API key (NOT the storage password) and the pull
# zone id. Skipped silently if either is missing (e.g. plain local upload).
if [[ -z "${BUNNY_API_KEY:-}" || -z "${BUNNY_PULLZONE_ID:-}" ]]; then
  echo "(skipping cache purge: set BUNNY_API_KEY + BUNNY_PULLZONE_ID to enable)"
  exit 0
fi

purge() {
  echo "Purging pull zone $BUNNY_PULLZONE_ID cache ..."
  local pcode
  pcode=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
    "https://api.bunny.net/pullzone/${BUNNY_PULLZONE_ID}/purgeCache" \
    -H "AccessKey: ${BUNNY_API_KEY}") || { echo "purge: curl failed" >&2; exit 1; }
  if [[ "$pcode" != "204" && "$pcode" != "200" ]]; then
    echo "purge returned HTTP $pcode" >&2
    exit 1
  fi
  echo "Purged."
}

# A storage zone with replication regions serves edges from the nearest
# replica, which can lag the upload. A purge that lands first makes the edge
# re-cache the OLD file from that replica, and it stays stale until it
# expires. With BUNNY_PUBLIC_URL set (the site the pull zone serves), keep
# purging until that URL serves this build's index.html and OAuth metadata,
# then purge once more so every edge refetches the replicated files. Only the
# edge nearest this machine is checked.
served_matches() {
  local base="${BUNNY_PUBLIC_URL%/}" ua='eurosky-deploy-check/1 (scripts/bunny_upload.sh)'
  # The page may be rewritten at the edge, so match on the main bundle name.
  local bundle
  bundle=$(grep -o 'static/js/main\.[^"]*\.js' "$DIR/index.html" | head -1)
  if [[ -n "$bundle" ]]; then
    curl -sS -m 15 -A "$ua" "$base/" | grep -qF "$bundle" || return 1
  fi
  if [[ -f "$DIR/oauth-client-metadata.json" ]]; then
    curl -sS -m 15 -A "$ua" "$base/oauth-client-metadata.json" \
      | cmp -s - "$DIR/oauth-client-metadata.json" || return 1
  fi
}

purge
if [[ -n "${BUNNY_PUBLIC_URL:-}" ]]; then
  wait_s="${BUNNY_EDGE_WAIT_SECONDS:-600}"
  deadline=$((SECONDS + wait_s))
  echo "Waiting for $BUNNY_PUBLIC_URL to serve this build (up to ${wait_s}s) ..."
  until served_matches; do
    if ((SECONDS >= deadline)); then
      msg="$BUNNY_PUBLIC_URL still serves an older build after ${wait_s}s; storage replicas may be lagging. Purge the pull zone again later."
      [[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::warning::$msg"
      echo "$msg" >&2
      break
    fi
    sleep 20
    purge
  done
  served_matches && echo "Edge serves the new build."
  purge
fi
