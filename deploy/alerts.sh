#!/usr/bin/env bash
###############################################################################
# alerts.sh — email alert on the refresh-failure signal (AZ-041 / ASM-010).
#
# Satisfies (SPEC 04):
#   AZ-041  Azure Monitor alert rule on the refresh-failure signal
#           (App Insights trace where consecutiveFailures >= 3) + an action group
#           emailing ALERT_EMAIL. Fulfills the docx "Email alerts" must-have.
#   AZ-063  no credential handling — assumes `az login` + provision.sh already ran.
#
# Kept separate from provision.sh so the alert (and its email recipient) can be
# re-run / re-pointed without touching infrastructure. Idempotent: re-running
# updates the action group + alert rule in place.
#
# NOT executed here. Reviewable, then run by the reviewer.
#
# Usage:  ./alerts.sh --prefix <same-prefix> --alert-email you@example.com
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$HERE/common.sh"

PREFIX="${PREFIX:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)      PREFIX="${2:?}"; shift 2 ;;
    --alert-email) ALERT_EMAIL="${2:?}"; shift 2 ;;
    -h|--help)     grep -E '^#( |!)' "${BASH_SOURCE[0]}" | sed 's/^#//'; exit 0 ;;
    *)             die "unknown argument: $1" ;;
  esac
done

require_login
require_prefix
[ -n "$ALERT_EMAIL" ] || die "ALERT_EMAIL is required (--alert-email you@example.com) — AZ-041."

RG="$RESOURCE_GROUP"
AI="$(insights_name)"
AG="$(action_group)"
ALERT="$(alert_name)"

az extension add --name application-insights --only-show-errors --yes >/dev/null 2>&1 || true

# App Insights resource id is the alert scope.
AI_ID="$(az monitor app-insights component show --app "$AI" --resource-group "$RG" --query id --output tsv 2>/dev/null)" \
  || die "App Insights '$AI' not found — run ./provision.sh --prefix $PREFIX first."

# ---- 1. Action group: email the reviewer (idempotent create-or-update) -------
info "Action group $AG -> $ALERT_EMAIL"
az monitor action-group create \
  --resource-group "$RG" --name "$AG" \
  --short-name "invflash" \
  --action email reviewer "$ALERT_EMAIL" \
  --output none
AG_ID="$(az monitor action-group show --resource-group "$RG" --name "$AG" --query id --output tsv)"

# ---- 2. Log-query alert: consecutiveFailures >= 3 (AZ-041) -------------------
# The refresh worker (SVC-014/SVC-034) emits an App Insights trace carrying
# consecutiveFailures as a custom dimension. Fire when any such trace in the
# 5-minute window reports >= 3 consecutive failures.
read -r -d '' KQL <<'KQL' || true
traces
| where timestamp > ago(5m)
| extend cf = toint(coalesce(
    tostring(customDimensions.consecutiveFailures),
    tostring(customMeasurements.consecutiveFailures)))
| where isnotnull(cf) and cf >= 3
| summarize AggregatedValue = max(cf) by bin(timestamp, 5m)
KQL

info "Alert rule $ALERT (consecutiveFailures >= 3)"
az monitor scheduled-query create \
  --resource-group "$RG" --name "$ALERT" \
  --scopes "$AI_ID" \
  --description "Inventory refresh job reported consecutiveFailures >= 3 (AZ-041/SVC-014)." \
  --condition "count 'failures' > 0" \
  --condition-query failures="$KQL" \
  --evaluation-frequency 5m \
  --window-size 5m \
  --severity 1 \
  --action-groups "$AG_ID" \
  --output none

ok "alerts.sh complete — refresh-failure email alert wired to $ALERT_EMAIL."
info "Test it via the cloud outage drill (MAN-504): trigger mock outage, wait for 3 failed cycles."
