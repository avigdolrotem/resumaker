#!/usr/bin/env bash
# Upload the local secret notepad to AWS Secrets Manager.
#
# Reads /Volumes/Server_Data/secrets/resumaker-prod-secret.json, strips
# the _comment_* keys (decorative), and pushes the rest as the value
# of the resumaker-prod/app secret.
#
# Idempotent: creates the secret on first run, updates it on subsequent
# runs. The secret itself is created by tofu (network env applies the
# `aws_secretsmanager_secret` resource), so we only ever PUT a new value.
#
# Usage: ./scripts/push-secrets.sh
#        (or `AWS_PROFILE=other-profile ./scripts/push-secrets.sh`)

set -euo pipefail

NOTEPAD="/Volumes/Server_Data/secrets/resumaker-prod-secret.json"
SECRET_ID="resumaker-prod/app"
PROFILE="${AWS_PROFILE:-resumaker}"
REGION="${AWS_REGION:-il-central-1}"

if [[ ! -f "$NOTEPAD" ]]; then
  echo "❌ Notepad not found at $NOTEPAD" >&2
  exit 1
fi

if ! command -v jq >/dev/null; then
  echo "❌ jq is required. brew install jq" >&2
  exit 1
fi

echo "▶ Strip comment keys from notepad and check for unfilled placeholders…"
PAYLOAD=$(jq 'with_entries(select(.key | startswith("_comment_") | not))' "$NOTEPAD")

# Refuse to upload if any value still looks like a placeholder. Better to
# fail loud than to push <pending> strings to AWS and silently break the
# app on the next deploy.
PLACEHOLDERS=$(echo "$PAYLOAD" | jq -r 'to_entries[] | select(.value | tostring | test("<.*>")) | .key')
if [[ -n "$PLACEHOLDERS" ]]; then
  echo "❌ Unfilled placeholders in notepad:" >&2
  echo "$PLACEHOLDERS" | sed 's/^/   - /' >&2
  echo "" >&2
  echo "Fill those in (or set to empty string \"\" if intentionally skipped) and re-run." >&2
  exit 1
fi

echo "▶ Verifying AWS auth (profile=$PROFILE region=$REGION)…"
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
echo "   Account: $ACCOUNT"

echo "▶ Pushing to Secrets Manager: $SECRET_ID"
aws secretsmanager put-secret-value \
  --profile "$PROFILE" \
  --region "$REGION" \
  --secret-id "$SECRET_ID" \
  --secret-string "$PAYLOAD" \
  --output table \
  --query '{VersionId:VersionId,Name:Name}'

echo ""
echo "✅ Done. Restart the deployment to pick up the new values:"
echo "   kubectl -n resumaker rollout restart deploy/resumaker"
echo ""
echo "ExternalSecret refreshes every 5m on its own — restart only if you"
echo "need the new values immediately."
