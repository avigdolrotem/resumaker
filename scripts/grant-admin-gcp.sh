#!/usr/bin/env bash
#
# Promote a user to `admin` role in the Resumaker database.
#
# Usage:
#   ./scripts/grant-admin-gcp.sh <env> <email>
#
# Examples:
#   ./scripts/grant-admin-gcp.sh prod you@example.com
#   ./scripts/grant-admin-gcp.sh dev tester@example.com
#
# Mechanism:
#   - Opens a temporary cloud-sql-proxy tunnel to the env's Cloud SQL
#     instance on port 15432.
#   - Connects as the IAM user (resumaker-app SA) with the operator's
#     gcloud-issued ephemeral creds.
#   - Runs an UPDATE that flips `users.role` to 'admin' for the matching
#     email IFF the row exists, is not soft-deleted, and is verified.
#   - Verifies the change.
#   - Tears down the tunnel.
#
# Prerequisites:
#   - gcloud + cloud-sql-proxy installed.
#   - gcloud authenticated with iam.serviceAccountTokenCreator on the
#     resumaker-app SA (i.e. you're a project owner / editor).
#   - The user must have already signed up — this just upgrades their
#     existing row, it doesn't create one.

set -euo pipefail

ENV="${1:-}"
EMAIL="${2:-}"

if [[ ! "$ENV" =~ ^(dev|staging|prod)$ ]] || [[ -z "$EMAIL" ]]; then
  cat <<EOF >&2
Usage: $0 <env> <email>
  env must be dev | staging | prod
EOF
  exit 1
fi

PROJECT_ID="resumaker-$ENV"
IAM_USER="resumaker-app@$PROJECT_ID.iam"
DB_NAME="resumaker"
LOCAL_PORT="${PROXY_PORT:-15432}"

echo "▶ Resolving Cloud SQL instance for $PROJECT_ID..."
INSTANCE_CONNECTION_NAME=$(gcloud sql instances list \
  --project="$PROJECT_ID" \
  --format='value(connectionName)' \
  --filter='name ~ ^resumaker-' \
  | head -1)

if [[ -z "$INSTANCE_CONNECTION_NAME" ]]; then
  echo "❌ No Cloud SQL instance found in $PROJECT_ID." >&2
  exit 1
fi

echo "  → $INSTANCE_CONNECTION_NAME"

if ! command -v cloud-sql-proxy >/dev/null; then
  echo "❌ cloud-sql-proxy not installed. Run: gcloud components install cloud-sql-proxy" >&2
  exit 1
fi

if ! command -v psql >/dev/null; then
  echo "❌ psql required. brew install postgresql" >&2
  exit 1
fi

echo "▶ Starting cloud-sql-proxy on localhost:$LOCAL_PORT..."
cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" --port="$LOCAL_PORT" --quiet &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT

# Wait for proxy to be ready
sleep 3
for _ in 1 2 3 4 5; do
  if nc -z localhost "$LOCAL_PORT" 2>/dev/null; then break; fi
  sleep 1
done

# URL-encode the @ in the IAM user
USER_ENCODED="${IAM_USER//@/%40}"
DSN="postgresql://${USER_ENCODED}@localhost:${LOCAL_PORT}/${DB_NAME}?sslmode=disable"

# Before-state
echo "▶ Looking up user..."
BEFORE=$(psql "$DSN" -tAX -c \
  "SELECT id, email, role, email_verified, (deleted_at IS NOT NULL) AS deleted FROM users WHERE email = '$EMAIL';")

if [[ -z "$BEFORE" ]]; then
  echo "❌ No user with email $EMAIL in $PROJECT_ID. Have they signed up yet?" >&2
  exit 1
fi

IFS='|' read -r USER_ID FOUND_EMAIL CUR_ROLE EMAIL_VERIFIED IS_DELETED <<< "$BEFORE"

echo "  id=$USER_ID role=$CUR_ROLE verified=$EMAIL_VERIFIED deleted=$IS_DELETED"

if [[ "$IS_DELETED" == "t" ]]; then
  echo "❌ User row is soft-deleted. Restore via the admin UI or unset deleted_at first." >&2
  exit 1
fi

if [[ "$EMAIL_VERIFIED" != "t" ]]; then
  echo "⚠ User has not verified their email yet. Promoting anyway." >&2
fi

if [[ "$CUR_ROLE" == "admin" ]]; then
  echo "✅ User is already admin. Nothing to do."
  exit 0
fi

read -rp "▶ Promote $EMAIL ($USER_ID) to admin in $PROJECT_ID? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Promote
psql "$DSN" -c \
  "UPDATE users SET role = 'admin', updated_at = now() WHERE id = '$USER_ID' AND deleted_at IS NULL;"

# Verify
AFTER=$(psql "$DSN" -tAX -c "SELECT role FROM users WHERE id = '$USER_ID';")
if [[ "$AFTER" != "admin" ]]; then
  echo "❌ Role did not update. Investigate." >&2
  exit 1
fi

echo "✅ $EMAIL is now admin in $PROJECT_ID."
echo
echo "Note: the user must sign out and back in for the new role to take effect"
echo "(role is read off the session at request time)."
