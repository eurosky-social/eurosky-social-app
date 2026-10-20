#!/usr/bin/env bash
# Build the web bundle for one deploy environment.
#
# Usage: ./scripts/web_build.sh <environment>
#   <environment> names .github/environments/<environment>.env and the GitHub
#   environment of the same name (production, staging, dev, oso, oso-dev).
#
# Loads .github/environments/common.env, then <environment>.env on top, and
# runs the brand's build (scripts/bunny_build.sh for Mu, build-oso-preview.sh
# for Oso). The same command reproduces a CI build locally. Uploading is a
# separate step (scripts/bunny_upload.sh) so a local build never deploys.
#
# Under GitHub Actions, writes `dir`, `url` and `edge_setup` to $GITHUB_OUTPUT.
set -euo pipefail
cd "$(dirname "$0")/.."

ENVIRONMENT="${1:?usage: web_build.sh <environment>}"
CONFIG_DIR=.github/environments
[[ "$ENVIRONMENT" =~ ^[a-z0-9-]+$ && -f "$CONFIG_DIR/$ENVIRONMENT.env" ]] || {
  echo "unknown environment '$ENVIRONMENT'; expected one of:" >&2
  ls "$CONFIG_DIR" | sed -n 's/\.env$//p' | grep -vx common >&2
  exit 1
}

set -a
. "$CONFIG_DIR/common.env"
. "$CONFIG_DIR/$ENVIRONMENT.env"
set +a

# Keep a developer's local .env from leaking into what should match CI.
export EXPO_NO_DOTENV=1

echo "Building $ENVIRONMENT ($DEPLOY_BRAND) for $DEPLOY_URL"
case "$DEPLOY_BRAND" in
  mu)
    bash scripts/bunny_build.sh
    DIR=web-build
    ;;
  oso)
    bash scripts/build-oso-preview.sh
    DIR=web-build-oso
    ;;
  *)
    echo "unknown DEPLOY_BRAND '$DEPLOY_BRAND'" >&2
    exit 1
    ;;
esac

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "dir=$DIR"
    echo "url=$DEPLOY_URL"
    echo "edge_setup=$DEPLOY_BUNNY_EDGE_SETUP"
  } >>"$GITHUB_OUTPUT"
fi
echo "Output: $DIR/"
