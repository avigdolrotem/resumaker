#!/usr/bin/env bash
#
# Rotate Resumaker secrets in GCP Secret Manager.
#
# Two modes:
#
# 1. INTERACTIVE — script prompts for each secret value (hidden input).
#    Press ENTER on a prompt to SKIP that secret (leave existing value).
#
#      ./scripts/rotate-secrets-gcp.sh prod
#
# 2. BATCH — read a JSON file. Missing keys are skipped. The file is
#    NEVER committed (it lives outside the repo and is wiped on success).
#
#      ./scripts/rotate-secrets-gcp.sh prod /tmp/new-secrets.json
#
# After all updates, optionally triggers a rollout restart so pods pick
# up the new values immediately (otherwise ExternalSecrets refreshes
# every 1 min on its own).
#
# Usage:
#   ./rotate-secrets-gcp.sh <env> [json-file]
#   where <env> ∈ {dev, staging, prod}
#
# Prerequisites:
#   - gcloud authenticated with permission to write to Secret Manager
#     in the target project (resumaker-<env>).
#   - kubectl context pointing at the target GKE cluster (only needed
#     if you want the optional rollout-restart step).

set -euo pipefail

ENV="${1:-}"
JSON_FILE="${2:-}"

if [[ ! "$ENV" =~ ^(dev|staging|prod)$ ]]; then
  cat <<EOF >&2
Usage: $0 <env> [json-file]
  env must be dev | staging | prod

Interactive (recommended for one-off rotations):
  $0 prod

Batch (from a JSON file with {"secret-name": "value", ...}):
  $0 prod /tmp/new-secrets.json
EOF
  exit 1
fi

PROJECT_ID="resumaker-$ENV"
NAMESPACE="${KUBE_NAMESPACE:-resumaker}"

# Canonical list of secrets — must match infra/tofu/modules/gcp/secrets/variables.tf
SECRETS=(
  anthropic-api-key
  ai-gateway-api-key
  better-auth-secret
  ip-hash-salt
  cron-secret
  resend-api-key
  sentry-dsn
  vapid-private-key
  stripe-secret-key
  stripe-webhook-secret
  lemonsqueezy-api-key
  lemonsqueezy-webhook-secret
  firecrawl-api-key
)

echo "▶ Target: project=$PROJECT_ID env=$ENV"
echo

if ! gcloud projects describe "$PROJECT_ID" --format='value(projectId)' >/dev/null 2>&1; then
  echo "❌ Project $PROJECT_ID not found or you lack permission." >&2
  exit 1
fi

push_secret() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    return 0
  fi

  if ! gcloud secrets describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "  ⚠ Secret '$name' does not exist in $PROJECT_ID — skipping. Run 'tofu apply' first."
    return 0
  fi

  if ! printf '%s' "$value" | gcloud secrets versions add "$name" \
      --project="$PROJECT_ID" \
      --data-file=- \
      --format='value(name)' >/dev/null 2>&1; then
    echo "  ❌ Failed to push $name"
    return 1
  fi

  echo "  ✅ $name updated"
}

ROTATED=()
SKIPPED=()

if [[ -n "$JSON_FILE" ]]; then
  # BATCH MODE
  if [[ ! -f "$JSON_FILE" ]]; then
    echo "❌ JSON file not found: $JSON_FILE" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null; then
    echo "❌ jq is required for batch mode. brew install jq" >&2
    exit 1
  fi

  echo "▶ Reading values from $JSON_FILE"
  for name in "${SECRETS[@]}"; do
    value="$(jq -r --arg k "$name" '.[$k] // empty' "$JSON_FILE")"
    if [[ -z "$value" ]] || [[ "$value" =~ ^\<.*\>$ ]]; then
      SKIPPED+=("$name")
      continue
    fi
    push_secret "$name" "$value" && ROTATED+=("$name")
  done

  # Wipe the file — defense in depth so leftover secrets don't sit around.
  echo
  read -rp "▶ Wipe $JSON_FILE now? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    shred -fu "$JSON_FILE" 2>/dev/null || rm -P "$JSON_FILE" 2>/dev/null || rm "$JSON_FILE"
    echo "  Wiped."
  else
    echo "  Left in place. Delete it manually: rm -P $JSON_FILE"
  fi

else
  # INTERACTIVE MODE
  echo "▶ Interactive mode — press ENTER to skip a secret."
  echo

  for name in "${SECRETS[@]}"; do
    echo -n "  $name: "
    # -s = hidden input
    read -rs value
    echo  # newline after hidden input

    if [[ -z "$value" ]]; then
      SKIPPED+=("$name")
      continue
    fi
    push_secret "$name" "$value" && ROTATED+=("$name")
  done
fi

echo
echo "════════════════════════════════════════════════"
echo "  Rotated: ${#ROTATED[@]}"
for s in "${ROTATED[@]}"; do echo "    ✓ $s"; done
echo "  Skipped: ${#SKIPPED[@]}"
for s in "${SKIPPED[@]}"; do echo "    - $s"; done
echo "════════════════════════════════════════════════"
echo

if [[ ${#ROTATED[@]} -eq 0 ]]; then
  echo "Nothing rotated. Exiting."
  exit 0
fi

# Optional: trigger a rollout restart so pods pick up new values immediately.
echo "▶ ExternalSecrets refresh interval = 1m. Pods will pick up new"
echo "  values automatically. To force an immediate rollout:"
echo
echo "    kubectl -n $NAMESPACE rollout restart deploy/resumaker"
echo

if command -v kubectl >/dev/null 2>&1; then
  read -rp "▶ Run rollout restart now? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    kubectl -n "$NAMESPACE" rollout restart deploy/resumaker
    echo "  Rollout triggered. Watch: kubectl -n $NAMESPACE rollout status deploy/resumaker"
  fi
fi

echo "✅ Done."
