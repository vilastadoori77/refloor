#!/usr/bin/env bash
###############################################################################
# teardown.sh — delete the entire resource group (AZ-062 / MAN-506).
#
# Satisfies (SPEC 04):
#   AZ-001/AZ-062  single-command teardown of `rg-inventory-flash`.
#   MAN-506        leaves zero resources behind.
#   AZ-063         no credential handling — assumes the reviewer ran `az login`.
#
# Interactive confirmation required (type the resource group name). Because
# everything provisioned lives in this one group, deleting it removes the plan,
# all three apps, Key Vault, App Insights, Redis, action group, and alert rule.
#
# NOTE on Key Vault: soft-delete may retain the vault name for the purge-
# protection window. Pass --purge-kv to also purge the soft-deleted vault so the
# name is immediately reusable.
#
# Usage:  ./teardown.sh [--yes] [--no-wait] [--purge-kv] [--prefix <p>]
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"

PREFIX="${PREFIX:-}"
ASSUME_YES="false"
NO_WAIT="false"
PURGE_KV="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)   ASSUME_YES="true"; shift ;;
    --no-wait)  NO_WAIT="true"; shift ;;
    --purge-kv) PURGE_KV="true"; shift ;;
    --prefix)   PREFIX="${2:?}"; shift 2 ;;
    -h|--help)  grep -E '^#( |!)' "${BASH_SOURCE[0]}" | sed 's/^#//'; exit 0 ;;
    *)          die "unknown argument: $1" ;;
  esac
done

require_login
RG="$RESOURCE_GROUP"

if ! az group show --name "$RG" --output none 2>/dev/null; then
  ok "Resource group '$RG' does not exist — nothing to tear down (MAN-506 already satisfied)."
  exit 0
fi

warn "About to DELETE resource group '$RG' and EVERYTHING in it:"
az resource list --resource-group "$RG" \
  --query "[].{name:name, type:type}" --output table 2>/dev/null || true

if [ "$ASSUME_YES" != "true" ]; then
  printf 'Type the resource group name (%s) to confirm deletion: ' "$RG" >&2
  read -r CONFIRM
  [ "$CONFIRM" = "$RG" ] || die "confirmation did not match — aborted. Nothing deleted."
fi

# Best-effort: capture the Key Vault name before the group goes away (for purge).
KV_TO_PURGE=""
if [ "$PURGE_KV" = "true" ]; then
  KV_TO_PURGE="$(az keyvault list --resource-group "$RG" --query "[0].name" --output tsv 2>/dev/null || true)"
fi

info "Deleting resource group '$RG'..."
if [ "$NO_WAIT" = "true" ]; then
  az group delete --name "$RG" --yes --no-wait
  ok "Delete started (running in background). Verify later: az group show --name $RG"
else
  az group delete --name "$RG" --yes
  ok "Resource group '$RG' deleted."
fi

if [ "$PURGE_KV" = "true" ] && [ -n "$KV_TO_PURGE" ]; then
  info "Purging soft-deleted Key Vault '$KV_TO_PURGE'"
  az keyvault purge --name "$KV_TO_PURGE" --output none 2>/dev/null \
    || warn "could not purge Key Vault '$KV_TO_PURGE' (may already be purged or purge-protected)."
fi

info "Verify zero resources remain (MAN-506):  az group show --name $RG   # expect: not found"
