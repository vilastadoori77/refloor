#!/usr/bin/env bash
# common.sh — shared constants + helpers for the Stage 5 Azure deploy scripts.
#
# Satisfies (shared across): AZ-001 (fixed resource-group name / single-command
# teardown), AZ-004 (deterministic resource naming from <PREFIX>), AZ-063 (never
# handles credentials — assumes the reviewer already ran `az login`).
#
# This file is *sourced* by provision.sh / deploy-apps.sh / alerts.sh /
# teardown.sh. It defines variables + functions only; it runs nothing on its own.
#
# All resources live in ONE resource group so `az group delete` is a complete
# teardown (AZ-001 / AZ-062 / MAN-506).

# ---- Fixed identifiers (do not change: teardown + specs depend on them) ------
: "${RESOURCE_GROUP:=rg-inventory-flash}"     # AZ-001 — the one and only RG

# ---- Tunable defaults (override via env or per-script flags) ------------------
: "${REGION:=eastus}"                          # AZ-001 — default region
: "${TIER:=free}"                              # DEC-001: free | paid
: "${AUTH:=stub}"                              # DEC-002: stub | entra
: "${NODE_RUNTIME:=NODE:20-lts}"               # AZ-003 — Node 18+ (20-LTS default)

# ---- Logging helpers ----------------------------------------------------------
info()  { printf '\033[0;36m[i]\033[0m %s\n'  "$*" >&2; }
ok()    { printf '\033[0;32m[+]\033[0m %s\n'  "$*" >&2; }
warn()  { printf '\033[0;33m[!]\033[0m %s\n'  "$*" >&2; }
die()   { printf '\033[0;31m[x]\033[0m %s\n'  "$*" >&2; exit 1; }

# ---- Preconditions ------------------------------------------------------------
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# AZ-063: we never log the reviewer in. We only assert they already did.
require_login() {
  require_cmd az
  az account show --output none 2>/dev/null \
    || die "not logged in — run 'az login' (and 'az account set --subscription <id>') first (AZ-063)."
}

# ---- Naming (AZ-004) ----------------------------------------------------------
# <PREFIX> must be globally unique because it becomes part of *.azurewebsites.net.
require_prefix() {
  [ -n "${PREFIX:-}" ] || die "PREFIX is required (set --prefix or PREFIX=... ). Must be globally unique (AZ-004)."
  case "$PREFIX" in
    *[!a-z0-9-]* ) die "PREFIX '$PREFIX' invalid: use lowercase letters, digits, hyphens only." ;;
  esac
}

# Derived names — every script derives the same names from the same PREFIX.
plan_name()      { printf '%s-plan'          "$PREFIX"; }
mock_app()       { printf '%s-mock-bc'       "$PREFIX"; }   # AZ-002/004
svc_app()        { printf '%s-inventory-svc' "$PREFIX"; }   # AZ-002/004
web_app()        { printf '%s-inventory-web' "$PREFIX"; }   # AZ-002/004
insights_name()  { printf '%s-ai'            "$PREFIX"; }   # AZ-040
redis_name()     { printf '%s-redis'         "$PREFIX"; }   # AZ-021
action_group()   { printf '%s-ag'            "$PREFIX"; }   # AZ-041
alert_name()     { printf '%s-refresh-failure' "$PREFIX"; } # AZ-041

# Key Vault name kv-<PREFIX>-inventory (AZ-010). KV names cap at 24 chars.
kv_name() {
  local name="kv-${PREFIX}-inventory"
  if [ "${#name}" -gt 24 ]; then
    die "Key Vault name '$name' is ${#name} chars (>24). Shorten PREFIX to <= $((24 - 13)) chars."
  fi
  printf '%s' "$name"
}

# HTTPS URL of a web app (AZ-005 — all apps are HTTPS-only).
app_url() { printf 'https://%s.azurewebsites.net' "$1"; }

# Build a Key Vault *reference* app-setting value (AZ-010 — no plaintext secrets).
# Versionless so secret rotation is picked up without redeploying (AZ-011).
kv_ref() {  # kv_ref <vault> <secret-name>
  printf '@Microsoft.KeyVault(VaultName=%s;SecretName=%s)' "$1" "$2"
}

# SKU + cache driver for the chosen tier (DEC-001 / AZ-003 / AZ-020 / AZ-021).
tier_sku() {
  case "$TIER" in
    free) printf 'F1' ;;
    paid) printf 'B1' ;;
    *)    die "TIER must be 'free' or 'paid' (got '$TIER')." ;;
  esac
}
tier_cache_driver() {
  case "$TIER" in
    free) printf 'memory' ;;   # AZ-020 (SVC-020 alternative)
    paid) printf 'redis'  ;;   # AZ-021
    *)    die "TIER must be 'free' or 'paid' (got '$TIER')." ;;
  esac
}

validate_auth() {
  case "$AUTH" in
    stub|entra) : ;;
    *) die "AUTH must be 'stub' or 'entra' (got '$AUTH')." ;;
  esac
}
