#!/usr/bin/env bash
###############################################################################
# provision.sh — Stage 5 Azure infrastructure for the Inventory Flash replica.
#
# Satisfies (SPEC 04):
#   AZ-001  one resource group `rg-inventory-flash` (single-command teardown)
#   AZ-002  three App Services (mock-bc, inventory-svc, inventory-web) on one plan
#   AZ-003  App Service plan F1 (free) or B1 (paid) per DEC-001, Node 18+
#   AZ-004  names <PREFIX>-mock-bc / -inventory-svc / -inventory-web
#   AZ-005  HTTPS-only on all three
#   AZ-010  Key Vault kv-<PREFIX>-inventory + managed identities + KV references
#   AZ-011  service app settings (BC_BASE_URL, REFRESH_SECONDS, WEB_ORIGIN, CACHE_DRIVER)
#   AZ-011a ADMIN_TOKEN in KV + service admin guard + mock admin not open publicly
#   AZ-012  web build gets the service URL (wired in deploy-apps.sh)
#   AZ-020  free tier -> CACHE_DRIVER=memory
#   AZ-021  paid tier -> Azure Cache for Redis Basic C0, TLS-only, URL in KV
#   AZ-040  Application Insights connected to the service
#   AZ-042  App Service health check -> /healthz on the service
#   AZ-030  AUTH=stub -> dev-stub login stays (nothing enabled here)
#   AZ-031  AUTH=entra -> App Service built-in auth (Easy Auth) on the web app
#   AZ-060  this script; parameters at top; prints every resource URL at the end
#   AZ-063  never handles credentials — assumes the reviewer ran `az login`
#
# NOT executed here (no Azure login). Written to be reviewed, then run by the
# reviewer. Idempotent where the CLI allows (create-if-absent patterns).
#
# Usage:
#   ./provision.sh --prefix <globally-unique> [--region eastus] \
#                  [--tier free|paid] [--auth stub|entra] [--alert-email you@x.com]
#   (any flag may instead be an env var: PREFIX, REGION, TIER, AUTH, ALERT_EMAIL)
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"

# ---- Parameters block (AZ-060) -----------------------------------------------
PREFIX="${PREFIX:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
# BC-AUTH-TOKEN is a *placeholder* in the replica (no real Refloor credential).
BC_AUTH_PLACEHOLDER="${BC_AUTH_PLACEHOLDER:-replica-placeholder-not-a-real-secret}"
# Optional: restrict the mock site to this CIDR (else admin routes are token-gated).
MOCK_ALLOWED_CIDR="${MOCK_ALLOWED_CIDR:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)      PREFIX="${2:?}"; shift 2 ;;
    --region)      REGION="${2:?}"; shift 2 ;;
    --tier)        TIER="${2:?}"; shift 2 ;;
    --auth)        AUTH="${2:?}"; shift 2 ;;
    --alert-email) ALERT_EMAIL="${2:?}"; shift 2 ;;
    --mock-cidr)   MOCK_ALLOWED_CIDR="${2:?}"; shift 2 ;;
    -h|--help)     grep -E '^#( |!)' "${BASH_SOURCE[0]}" | sed 's/^#//'; exit 0 ;;
    *)             die "unknown argument: $1" ;;
  esac
done

require_login
require_prefix
validate_auth
require_cmd openssl

RG="$RESOURCE_GROUP"
PLAN="$(plan_name)"
MOCK="$(mock_app)"; SVC="$(svc_app)"; WEB="$(web_app)"
KV="$(kv_name)"; AI="$(insights_name)"
SKU="$(tier_sku)"; CACHE_DRIVER="$(tier_cache_driver)"

info "Provisioning '$PREFIX' — tier=$TIER auth=$AUTH region=$REGION rg=$RG"

# ---- 1. Resource group (AZ-001) — idempotent ---------------------------------
info "Resource group $RG"
az group create --name "$RG" --location "$REGION" --output none

# ---- 2. App Service plan (AZ-003) — one Linux plan, F1 or B1 -----------------
info "App Service plan $PLAN (sku=$SKU, linux)"
if ! az appservice plan show --name "$PLAN" --resource-group "$RG" --output none 2>/dev/null; then
  az appservice plan create \
    --name "$PLAN" --resource-group "$RG" --location "$REGION" \
    --is-linux --sku "$SKU" --output none
fi

# ---- 3. Three Web Apps (AZ-002/004) — Node 18+ -------------------------------
for app in "$MOCK" "$SVC" "$WEB"; do
  info "Web App $app ($NODE_RUNTIME)"
  if ! az webapp show --name "$app" --resource-group "$RG" --output none 2>/dev/null; then
    az webapp create \
      --resource-group "$RG" --plan "$PLAN" --name "$app" \
      --runtime "$NODE_RUNTIME" --output none
  fi
  # AZ-005: HTTPS only (the *.azurewebsites.net cert is automatic).
  az webapp update --resource-group "$RG" --name "$app" --https-only true --output none
  # AZ-010: system-assigned managed identity for Key Vault references.
  az webapp identity assign --resource-group "$RG" --name "$app" --output none
done

# alwaysOn keeps the in-process refresh worker running — only available on B1+.
# On F1 it cannot be set; the app idles out and the next request repopulates the
# in-memory cache (documented limitation, AZ-020).
if [ "$TIER" = "paid" ]; then
  for app in "$MOCK" "$SVC"; do
    az webapp config set --resource-group "$RG" --name "$app" --always-on true --output none
  done
fi

# Resolve hostnames now that the apps exist (AZ-011 wiring, AZ-060 print).
MOCK_URL="$(app_url "$MOCK")"
SVC_URL="$(app_url "$SVC")"
WEB_URL="$(app_url "$WEB")"

# ---- 4. Key Vault + secrets (AZ-010 / AZ-011a) -------------------------------
info "Key Vault $KV"
if ! az keyvault show --name "$KV" --resource-group "$RG" --output none 2>/dev/null; then
  # Access-policy model (not RBAC) so managed-identity KV references resolve
  # with a simple get/list grant.
  az keyvault create \
    --name "$KV" --resource-group "$RG" --location "$REGION" \
    --enable-rbac-authorization false --output none
fi

# BC-AUTH-TOKEN: placeholder only (replica has no real credential — AZ-010).
az keyvault secret set --vault-name "$KV" --name "BC-AUTH-TOKEN" \
  --value "$BC_AUTH_PLACEHOLDER" --output none

# ADMIN-TOKEN: generated, never printed to stdout (AZ-011a).
ADMIN_TOKEN_VALUE="$(openssl rand -hex 32)"
az keyvault secret set --vault-name "$KV" --name "ADMIN-TOKEN" \
  --value "$ADMIN_TOKEN_VALUE" --output none
unset ADMIN_TOKEN_VALUE
ok "ADMIN-TOKEN generated and stored in Key Vault (not shown)."

# Grant each app's managed identity get/list on secrets (AZ-010).
for app in "$MOCK" "$SVC" "$WEB"; do
  PRINCIPAL_ID="$(az webapp identity show --resource-group "$RG" --name "$app" --query principalId --output tsv)"
  [ -n "$PRINCIPAL_ID" ] || die "no managed identity principalId for $app"
  az keyvault set-policy --name "$KV" --object-id "$PRINCIPAL_ID" \
    --secret-permissions get list --output none
done

# ---- 5. Cache: Redis for paid tier (AZ-021) ----------------------------------
REDIS_REF=""
if [ "$TIER" = "paid" ]; then
  REDIS="$(redis_name)"
  info "Azure Cache for Redis $REDIS (Basic C0, TLS-only) — this can take 15-20 min"
  if ! az redis show --name "$REDIS" --resource-group "$RG" --output none 2>/dev/null; then
    az redis create \
      --name "$REDIS" --resource-group "$RG" --location "$REGION" \
      --sku Basic --vm-size c0 \
      --minimum-tls-version 1.2 --enable-non-ssl-port false --output none
  fi
  REDIS_HOST="$(az redis show --name "$REDIS" --resource-group "$RG" --query hostName --output tsv)"
  REDIS_KEY="$(az redis list-keys --name "$REDIS" --resource-group "$RG" --query primaryKey --output tsv)"
  # rediss:// (TLS) on 6380. Stored ONLY in Key Vault, never in app settings.
  REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380"
  az keyvault secret set --vault-name "$KV" --name "REDIS-URL" --value "$REDIS_URL" --output none
  unset REDIS_KEY REDIS_URL
  REDIS_REF="$(kv_ref "$KV" "REDIS-URL")"
  ok "REDIS-URL stored in Key Vault (not shown)."
fi

# ---- 6. Application Insights (AZ-040) ----------------------------------------
info "Application Insights $AI"
az extension add --name application-insights --only-show-errors --yes >/dev/null 2>&1 || true
if ! az monitor app-insights component show --app "$AI" --resource-group "$RG" --output none 2>/dev/null; then
  az monitor app-insights component create \
    --app "$AI" --location "$REGION" --resource-group "$RG" \
    --application-type web --output none
fi
AI_CONN="$(az monitor app-insights component show --app "$AI" --resource-group "$RG" --query connectionString --output tsv)"

# ---- 7. App settings (AZ-011 / AZ-011a) --------------------------------------
BC_AUTH_REF="$(kv_ref "$KV" "BC-AUTH-TOKEN")"
ADMIN_REF="$(kv_ref "$KV" "ADMIN-TOKEN")"

# inventory-service: config + secrets as Key Vault references (no plaintext).
info "Configuring $SVC app settings (Key Vault references)"
SVC_SETTINGS=(
  "BC_BASE_URL=$MOCK_URL"
  "REFRESH_SECONDS=300"
  "WEB_ORIGIN=$WEB_URL"
  "CACHE_DRIVER=$CACHE_DRIVER"
  "NODE_ENV=production"
  "ADMIN_API_REQUIRE_TOKEN=true"           # SVC-045 production admin guard (AZ-011a)
  "ADMIN_TOKEN=$ADMIN_REF"
  "BC_AUTH_TOKEN=$BC_AUTH_REF"
  "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN"
  "SCM_DO_BUILD_DURING_DEPLOYMENT=true"     # Oryx builds the monorepo on deploy
)
[ -n "$REDIS_REF" ] && SVC_SETTINGS+=( "REDIS_URL=$REDIS_REF" )
az webapp config appsettings set --resource-group "$RG" --name "$SVC" \
  --settings "${SVC_SETTINGS[@]}" --output none

# mock-bc-api: gate its /admin/outage routes with the same ADMIN_TOKEN so the
# mock is not an open mutation surface (AZ-011a). Optionally IP-restrict too.
info "Configuring $MOCK app settings (admin gated)"
az webapp config appsettings set --resource-group "$RG" --name "$MOCK" \
  --settings \
    "NODE_ENV=production" \
    "ADMIN_API_REQUIRE_TOKEN=true" \
    "ADMIN_TOKEN=$ADMIN_REF" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
  --output none

if [ -n "$MOCK_ALLOWED_CIDR" ]; then
  info "IP-restricting $MOCK to $MOCK_ALLOWED_CIDR (unmatched traffic denied)"
  az webapp config access-restriction add --resource-group "$RG" --name "$MOCK" \
    --rule-name "reviewer-allow" --action Allow --priority 100 \
    --ip-address "$MOCK_ALLOWED_CIDR" --output none || \
    warn "access-restriction add failed (rule may already exist) — continuing"
fi

# inventory-web: static SPA, no secrets. Startup command set in deploy-apps.sh.
info "Configuring $WEB app settings"
az webapp config appsettings set --resource-group "$RG" --name "$WEB" \
  --settings \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=false" \
    "WEBSITE_NODE_DEFAULT_VERSION=~20" \
  --output none

# ---- 8. Health check -> /healthz on the service (AZ-042) ---------------------
info "Health check /healthz on $SVC"
az webapp update --resource-group "$RG" --name "$SVC" \
  --set siteConfig.healthCheckPath="/healthz" --output none || \
  warn "could not set healthCheckPath (F1 free tier does not act on health checks; AZ-042 applies fully on B1)."

# ---- 9. Auth branch (DEC-002) ------------------------------------------------
if [ "$AUTH" = "entra" ]; then
  # AZ-031: App Service built-in auth (Easy Auth) on the web app — no code change.
  info "Enabling Entra ID Easy Auth on $WEB"
  TENANT_ID="$(az account show --query tenantId --output tsv)"
  CLIENT_ID="${AAD_CLIENT_ID:-}"
  if [ -z "$CLIENT_ID" ]; then
    # Requires directory permission to register an app. Reviewer can instead
    # pass AAD_CLIENT_ID for an existing registration.
    CLIENT_ID="$(az ad app create \
      --display-name "${WEB}-easyauth" \
      --web-redirect-uris "${WEB_URL}/.auth/login/aad/callback" \
      --query appId --output tsv)" \
      || die "app registration failed — pass AAD_CLIENT_ID=<existing app id> or grant directory permission (AZ-031)."
  fi
  az webapp auth microsoft update --resource-group "$RG" --name "$WEB" \
    --client-id "$CLIENT_ID" --tenant-id "$TENANT_ID" --yes --output none
  az webapp auth update --resource-group "$RG" --name "$WEB" \
    --enabled true --action LoginWithAzureActiveDirectory --output none
  ok "Easy Auth enabled (client-id $CLIENT_ID). Reviewer may need to grant admin consent."
else
  # AZ-030: dev-stub login stays. Explicitly labeled non-production.
  info "AUTH=stub — dev-stub login kept (clearly non-production, AZ-030). No Easy Auth."
fi

# ---- 10. Print every resource URL (AZ-060) -----------------------------------
cat >&2 <<EOF

===============================================================================
 Provisioned. Next: ./deploy-apps.sh --prefix $PREFIX   (then ./alerts.sh)
-------------------------------------------------------------------------------
 Resource group : $RG   (region $REGION, tier $TIER, auth $AUTH)
 App Service plan: $PLAN ($SKU)
 Mock BC API     : $MOCK_URL
 Inventory Svc   : $SVC_URL   (health: $SVC_URL/healthz)
 Inventory Web   : $WEB_URL
 Key Vault       : https://$KV.vault.azure.net/
 App Insights    : $AI
$( [ "$TIER" = paid ] && printf ' Redis           : %s (Basic C0, TLS-only)\n' "$(redis_name)" )
 Cache driver    : $CACHE_DRIVER
===============================================================================
EOF
ok "provision.sh complete."
