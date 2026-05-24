#!/usr/bin/env bash
# Vercel preview one-shot setup.
#
# Prerequisites (do these first, then run this script):
#   1. Sign up at https://neon.tech, create a project, copy the connection string.
#   2. Run `vercel login` (browser flow).
#   3. Run `vercel link` from the repo root:
#         - Set up project? yes
#         - Scope: your personal account
#         - Link to existing project? no
#         - Project name: resumaker-preview
#         - Code directory: ./apps/web
#
# Then run THIS script with two arguments:
#   ./scripts/vercel-preview-setup.sh \
#       'postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require' \
#       'https://resumaker-preview.vercel.app'
#
# (the second arg is the URL Vercel assigned you — `vercel link` printed it,
#  or run `vercel ls` to see)

set -euo pipefail

DATABASE_URL="${1:-}"
VERCEL_URL="${2:-}"
NOTEPAD="/Volumes/Server_Data/secrets/resumaker-prod-secret.json"

if [[ -z "$DATABASE_URL" || -z "$VERCEL_URL" ]]; then
  echo "Usage: $0 <neon-database-url> <vercel-url>"
  echo "Example: $0 'postgres://...neon.tech/neondb' 'https://resumaker-preview.vercel.app'"
  exit 1
fi

if [[ ! -f "$NOTEPAD" ]]; then
  echo "✗ Notepad not found at $NOTEPAD"
  exit 1
fi

# Strip any trailing slash from the Vercel URL — Better Auth is strict.
VERCEL_URL="${VERCEL_URL%/}"

echo "▶ Pulling secrets from notepad…"
ANTHROPIC_API_KEY="$(jq -r .ANTHROPIC_API_KEY "$NOTEPAD")"
BETTER_AUTH_SECRET="$(jq -r .BETTER_AUTH_SECRET "$NOTEPAD")"
IP_HASH_SALT="$(jq -r .IP_HASH_SALT "$NOTEPAD")"
CRON_SECRET="$(jq -r .CRON_SECRET "$NOTEPAD")"
RESEND_API_KEY="$(jq -r '.RESEND_API_KEY // ""' "$NOTEPAD")"
SENTRY_DSN="$(jq -r '.SENTRY_DSN // ""' "$NOTEPAD")"
GOOGLE_CLIENT_ID="$(jq -r '.GOOGLE_CLIENT_ID // ""' "$NOTEPAD")"
GOOGLE_CLIENT_SECRET="$(jq -r '.GOOGLE_CLIENT_SECRET // ""' "$NOTEPAD")"

if [[ "$ANTHROPIC_API_KEY" == "null" || "$ANTHROPIC_API_KEY" == "<pending>" || -z "$ANTHROPIC_API_KEY" ]]; then
  echo "✗ ANTHROPIC_API_KEY is missing in $NOTEPAD"
  exit 1
fi

# Helper: pipe a value into `vercel env add NAME production`
# `vercel env add` reads stdin so we don't have to type each value.
push_env() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  · skipping $key (empty)"
    return
  fi
  # Remove existing first so we can re-run cleanly. `vercel env rm` errors
  # if the key doesn't exist — swallow that with || true.
  printf 'y\n' | vercel env rm "$key" production >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" production >/dev/null
  echo "  ✓ $key"
}

echo "▶ Applying migrations to Neon…"
cd "$(dirname "$0")/.."
DATABASE_URL="$DATABASE_URL" pnpm -C apps/web exec drizzle-kit migrate

echo "▶ Pushing env vars to Vercel (production scope)…"
push_env DATABASE_URL "$DATABASE_URL"
push_env ANTHROPIC_API_KEY "$ANTHROPIC_API_KEY"
push_env BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"
push_env IP_HASH_SALT "$IP_HASH_SALT"
push_env CRON_SECRET "$CRON_SECRET"
push_env BETTER_AUTH_URL "$VERCEL_URL"
push_env APP_URL "$VERCEL_URL"
push_env NEXT_PUBLIC_APP_URL "$VERCEL_URL"
push_env NODE_ENV "production"
push_env PAYMENT_PROVIDER "none"
push_env DEFAULT_LOCALE "he"
push_env SUPPORTED_LOCALES "he,en,ar,ru"

# Optional — only pushed if present in the notepad
push_env RESEND_API_KEY "$RESEND_API_KEY"
push_env SENTRY_DSN "$SENTRY_DSN"
push_env GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
push_env GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"

echo ""
echo "✓ All env vars set. Now deploy:"
echo ""
echo "    vercel --prod"
echo ""
echo "First build takes 3-5 min. URL prints at the end of the output."
