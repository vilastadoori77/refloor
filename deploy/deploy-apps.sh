#!/usr/bin/env bash
###############################################################################
# deploy-apps.sh — build + zip-deploy all three apps to Azure (AZ-061).
#
# Satisfies (SPEC 04):
#   AZ-061  builds and zip-deploys mock-bc / inventory-svc / inventory-web
#           via `az webapp deploy`; React built with production env.
#   AZ-012  the web build receives the service URL at build time (VITE_API_BASE_URL)
#           so the browser talks only to inventory-service (WEB-003 holds in cloud).
#   AZ-063  no credential handling — assumes `az login` + provision.sh already ran.
#
# Deployment model (this is a tsx monorepo; `shared` is raw TypeScript):
#   * mock + svc  : deploy the whole repo (minus node_modules/dist/git/docs).
#                   Oryx remote build runs `npm install` for the workspaces on the
#                   server; startup runs the app under tsx (see startup commands).
#   * web         : built locally with the service URL injected, then the static
#                   `dist/` is deployed and served with `pm2 serve --spa`.
#
# NOT executed here. Reviewable, then run by the reviewer after provision.sh.
#
# Usage:  ./deploy-apps.sh --prefix <same-prefix-as-provision>
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"

PREFIX="${PREFIX:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)  PREFIX="${2:?}"; shift 2 ;;
    -h|--help) grep -E '^#( |!)' "${BASH_SOURCE[0]}" | sed 's/^#//'; exit 0 ;;
    *)         die "unknown argument: $1" ;;
  esac
done

require_login
require_prefix
require_cmd npm
require_cmd zip

RG="$RESOURCE_GROUP"
MOCK="$(mock_app)"; SVC="$(svc_app)"; WEB="$(web_app)"

# Confirm the apps exist (provision.sh must have run first).
for app in "$MOCK" "$SVC" "$WEB"; do
  az webapp show --name "$app" --resource-group "$RG" --output none 2>/dev/null \
    || die "web app '$app' not found — run ./provision.sh --prefix $PREFIX first."
done

SVC_URL="$(app_url "$SVC")"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# ---- 1. Backend zip (mock + svc share the same monorepo payload) -------------
# Exclude node_modules (Oryx installs on the server), build output, VCS, docs,
# the large .docx source files, and the deploy scripts themselves.
info "Packaging monorepo for the backend apps"
BACKEND_ZIP="$STAGE/backend.zip"
( cd "$REPO_ROOT" && zip -r -q "$BACKEND_ZIP" . \
    -x 'node_modules/*' '*/node_modules/*' \
    -x '.git/*' \
    -x 'dist/*' '*/dist/*' 'build/*' '*/build/*' \
    -x 'deploy/*' \
    -x 'docs/*' \
    -x '*.docx' \
    -x '.DS_Store' '*/.DS_Store' )

deploy_backend() {  # deploy_backend <app> <startup-file>
  local app="$1" startup="$2"
  info "Deploying $app (Oryx remote build)"
  az webapp config set --resource-group "$RG" --name "$app" \
    --startup-file "$startup" --output none
  az webapp deploy --resource-group "$RG" --name "$app" \
    --src-path "$BACKEND_ZIP" --type zip --output none
}

# tsx runs the TypeScript entrypoints directly (npx fetches tsx if the server
# pruned dev-deps under NODE_ENV=production). Working dir is the repo root.
deploy_backend "$MOCK" "npx --yes tsx mock-bc-api/src/index.ts"
deploy_backend "$SVC"  "npx --yes tsx inventory-service/src/index.ts"

# ---- 2. Frontend: build with the service URL injected, deploy static (AZ-012)-
info "Building inventory-web with VITE_API_BASE_URL=$SVC_URL"
( cd "$REPO_ROOT" && npm ci )
# WEB-003 in cloud: the browser calls this absolute service URL (never the mock).
( cd "$REPO_ROOT" && VITE_API_BASE_URL="$SVC_URL" NODE_ENV=production npm run build -w inventory-web )

WEB_DIST="$REPO_ROOT/inventory-web/dist"
[ -d "$WEB_DIST" ] || die "web build produced no dist/ at $WEB_DIST"
WEB_ZIP="$STAGE/web.zip"
( cd "$WEB_DIST" && zip -r -q "$WEB_ZIP" . )

info "Deploying $WEB (static SPA via pm2 serve)"
az webapp config set --resource-group "$RG" --name "$WEB" \
  --startup-file "pm2 serve /home/site/wwwroot --no-daemon --spa" --output none
az webapp deploy --resource-group "$RG" --name "$WEB" \
  --src-path "$WEB_ZIP" --type zip --output none

cat >&2 <<EOF

===============================================================================
 Apps deployed. Give them a minute to warm up, then verify:
   Mock BC API : $(app_url "$MOCK")
   Inventory   : $SVC_URL   (health: $SVC_URL/healthz)
   Website     : $(app_url "$WEB")
 Next: ./alerts.sh --prefix $PREFIX --alert-email <you@example.com>  (AZ-041)
===============================================================================
EOF
ok "deploy-apps.sh complete."
