#!/usr/bin/env bash
# Pre-flight check before running `tofu apply` for the first time.
#
# Catches the things that would otherwise blow up mid-apply, like
# missing AWS auth, an un-filled secrets notepad, or an ACM cert that
# hasn't validated yet.
#
# Run from anywhere:  ./scripts/validate-prerequisites.sh
# Exit code 0 = ready to apply; non-zero = read the output.

set -uo pipefail

PROFILE="${AWS_PROFILE:-resumaker}"
REGION="${AWS_REGION:-il-central-1}"
NOTEPAD="/Volumes/Server_Data/secrets/resumaker-prod-secret.json"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TFVARS="$REPO_ROOT/infra/tofu/environments/prod/terraform.tfvars"
PROD_VALUES="$REPO_ROOT/infra/helm/resumaker/values.prod.yaml"

ok()    { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn()  { printf "  \033[33m⚠\033[0m %s\n" "$1"; WARN_COUNT=$((WARN_COUNT+1)); }
fail()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
section(){ printf "\n\033[1m▶ %s\033[0m\n" "$1"; }

WARN_COUNT=0
FAIL_COUNT=0

# ─── 1. Required CLI tools ──────────────────────────────────────────
section "CLI tools"
for tool in aws jq tofu kubectl helm gh git docker; do
  if command -v "$tool" >/dev/null; then
    ok "$tool found ($(command -v "$tool"))"
  else
    if [[ "$tool" == "docker" ]]; then
      warn "$tool not found — needed only for local image builds, can skip if you only use CI"
    else
      fail "$tool not installed (brew install $tool)"
    fi
  fi
done

# ─── 2. AWS auth ────────────────────────────────────────────────────
section "AWS auth (profile=$PROFILE region=$REGION)"
if aws sts get-caller-identity --profile "$PROFILE" >/dev/null 2>&1; then
  account=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
  if [[ "$account" == "857812839967" ]]; then
    ok "auth OK, account 857812839967 (resumaker)"
  else
    fail "wrong account: $account (expected 857812839967)"
  fi
else
  fail "AWS auth failed for profile=$PROFILE — run `aws configure --profile $PROFILE`"
fi

# ─── 3. ACM certs are ISSUED ────────────────────────────────────────
# Parallel arrays instead of `declare -A` — assoc-array keys with dots
# trip bash arithmetic parsing in certain `${arr[$k]}` paths.
section "ACM certificates (il-central-1)"
CERT_DOMAINS=("resumaker.co.il" "argocd.resumaker.co.il")
CERT_ARNS=(
  "arn:aws:acm:il-central-1:857812839967:certificate/5866e9a6-d8fa-4ce3-b4b6-e52353836872"
  "arn:aws:acm:il-central-1:857812839967:certificate/ef39d165-ed03-401b-8e8c-ba8c340f8e4c"
)
for i in "${!CERT_DOMAINS[@]}"; do
  domain="${CERT_DOMAINS[$i]}"
  arn="${CERT_ARNS[$i]}"
  status=$(aws acm describe-certificate --profile "$PROFILE" --region "$REGION" \
    --certificate-arn "$arn" --query 'Certificate.Status' --output text 2>/dev/null || echo "ERROR")
  if [[ "$status" == "ISSUED" ]]; then
    ok "$domain → ISSUED"
  elif [[ "$status" == "PENDING_VALIDATION" ]]; then
    warn "$domain → PENDING_VALIDATION (add CNAME records to Cloudflare; wait ~30 min)"
  else
    fail "$domain → $status (expected ISSUED)"
  fi
done

# ─── 4. Cert ARNs are in the right places ───────────────────────────
section "Cert ARNs wired into repo + tfvars"
if grep -q "5866e9a6-d8fa-4ce3-b4b6-e52353836872" "$PROD_VALUES" 2>/dev/null; then
  ok "resumaker.co.il ARN in values.prod.yaml"
else
  fail "resumaker.co.il ARN missing from $PROD_VALUES"
fi
if [[ -f "$TFVARS" ]] && grep -q "ef39d165-ed03-401b-8e8c-ba8c340f8e4c" "$TFVARS"; then
  ok "argocd.resumaker.co.il ARN in terraform.tfvars"
else
  fail "argocd.resumaker.co.il ARN missing from $TFVARS"
fi

# ─── 5. Secrets notepad is complete ─────────────────────────────────
section "Secrets notepad"
if [[ -f "$NOTEPAD" ]]; then
  ok "notepad exists at $NOTEPAD"
  unfilled=$(jq -r 'with_entries(select(.key | startswith("_comment_") | not)) |
                    to_entries[] |
                    select(.value | tostring | test("<.*>")) |
                    .key' "$NOTEPAD" 2>/dev/null)
  if [[ -z "$unfilled" ]]; then
    ok "all fields filled (no <placeholder> strings)"
  else
    fail_count=$(echo "$unfilled" | wc -l | tr -d ' ')
    warn "$fail_count fields still have <placeholder> values:"
    echo "$unfilled" | sed 's/^/      /'
  fi
else
  fail "notepad not found at $NOTEPAD — copy from /Volumes/Server_Data/secrets/"
fi

# ─── 6. GitHub repo + secrets ───────────────────────────────────────
section "GitHub repo + Actions secrets"
if gh auth status >/dev/null 2>&1; then
  ok "gh CLI authed"
  if gh repo view avigdolrotem/resumaker >/dev/null 2>&1; then
    ok "repo avigdolrotem/resumaker accessible"
    required_secrets=(AWS_DEPLOY_ROLE_ARN AWS_ACCOUNT_ID AWS_REGION NEXT_PUBLIC_SENTRY_DSN)
    set_secrets=$(gh secret list --repo avigdolrotem/resumaker --json name --jq '.[].name' 2>/dev/null || echo "")
    for s in "${required_secrets[@]}"; do
      if echo "$set_secrets" | grep -qx "$s"; then
        ok "secret $s is set"
      else
        warn "secret $s is NOT set (gh secret set $s)"
      fi
    done
  else
    fail "cannot access avigdolrotem/resumaker — gh auth?"
  fi
else
  fail "gh not authed — run \`gh auth login\`"
fi

# ─── 7. OpenTofu state backend ──────────────────────────────────────
section "OpenTofu state backend"
if aws s3api head-bucket --profile "$PROFILE" --bucket resumaker-tofu-state >/dev/null 2>&1; then
  ok "S3 bucket resumaker-tofu-state exists"
else
  warn "S3 bucket missing — run ./scripts/bootstrap-tofu-state.sh first"
fi

# ─── 8. AWS IAM role for GitHub OIDC ────────────────────────────────
section "IAM role for GitHub OIDC"
if aws iam get-role --profile "$PROFILE" --role-name resumaker-github-deploy >/dev/null 2>&1; then
  ok "role resumaker-github-deploy exists"
else
  warn "role missing — follow docs/runbooks/github-actions-oidc-setup.md"
fi

# ─── 9. Payment provider configured ─────────────────────────────────
# `PAYMENT_PROVIDER=none` is the safe default for previews + tests but
# means the pricing page CTA is a waitlist link, not Checkout. Warn so
# we don't ship to prod with payments accidentally disabled.
section "Payment provider"
PROVIDER_VALUE="$(jq -r '.PAYMENT_PROVIDER // "none"' "$NOTEPAD" 2>/dev/null || echo "none")"
case "$PROVIDER_VALUE" in
  lemonsqueezy)
    ok "PAYMENT_PROVIDER=lemonsqueezy"
    for f in LEMONSQUEEZY_API_KEY LEMONSQUEEZY_STORE_ID LEMONSQUEEZY_WEBHOOK_SECRET; do
      VAL="$(jq -r ".$f // \"\"" "$NOTEPAD" 2>/dev/null)"
      if [[ -z "$VAL" || "$VAL" == "<pending>" ]]; then
        fail "$f is empty in notepad — LS checkout will fail"
      fi
    done
    ;;
  stripe)
    ok "PAYMENT_PROVIDER=stripe"
    for f in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
      VAL="$(jq -r ".$f // \"\"" "$NOTEPAD" 2>/dev/null)"
      if [[ -z "$VAL" || "$VAL" == "<pending>" ]]; then
        fail "$f is empty in notepad — Stripe checkout will fail"
      fi
    done
    ;;
  none|"")
    warn "PAYMENT_PROVIDER=none — pricing page will show waitlist CTA (no revenue path)"
    ;;
  *)
    fail "PAYMENT_PROVIDER='$PROVIDER_VALUE' is not one of: lemonsqueezy, stripe, none"
    ;;
esac

# ─── Summary ────────────────────────────────────────────────────────
printf "\n\033[1mSummary:\033[0m %d ✗ failures, %d ⚠ warnings\n" "$FAIL_COUNT" "$WARN_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  printf "\n\033[31mNOT ready to apply.\033[0m Fix failures above first.\n"
  exit 1
elif [[ "$WARN_COUNT" -gt 0 ]]; then
  printf "\n\033[33mReady to apply with caveats.\033[0m Address warnings if you can.\n"
  exit 0
else
  printf "\n\033[32mAll checks pass. Ready to \`tofu apply\`.\033[0m\n"
  exit 0
fi
