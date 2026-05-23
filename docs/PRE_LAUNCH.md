# Pre-Launch Checklist

> Run through this top-to-bottom before pushing to production for the first time.

## ✅ Already Done (no action needed)

- [x] BUSL-1.1 license applied
- [x] All secrets gitignored, gitleaks clean across history
- [x] AWS key rotated, old key revoked
- [x] Domain registered (`resumaker.co.il`)
- [x] Cloudflare nameservers set on registrar (propagation pending check)
- [x] 116 unit tests + 16 E2E tests passing
- [x] 7/7 packages typecheck clean
- [x] AWS Budget alerts at 50/80/100/120% configured
- [x] AI safety layer with 58 adversarial tests
- [x] Hebrew RTL + English LTR working
- [x] Email service scaffolded (logs to console without API key)
- [x] Sentry scaffolded (no-op without DSN)
- [x] DEPLOY.md + 4 runbooks written
- [x] Tier system (free/pro/premium) with feature gates wired into
      resume create, generate, duplicate, and cover letter routes
- [x] Stripe stubs (checkout, portal, webhook) — dormant until STRIPE_ENABLED=true
- [x] Admin tier dropdown for granting premium to friends without Stripe
- [x] Pricing page + /account/billing page (shows tier, usage, upgrade CTA)
- [x] EKS OpenTofu module wrapping terraform-aws-modules/eks
- [x] ArgoCD + External Secrets Operator + ALB Controller installed via tofu
- [x] GitOps manifests under `infra/gitops/` (app-of-apps pattern)
- [x] `.github/workflows/deploy.yml` — tag push builds + bumps Helm values
- [x] **Payment provider abstraction** — `PAYMENT_PROVIDER` env switches
      between Stripe and LemonSqueezy. Same UI, same gates, same DB; just
      flip the env. Default `none` shows waitlist CTA.
- [x] LemonSqueezy webhook handler at `/api/billing/webhook/lemonsqueezy`
- [x] Stripe webhook handler at `/api/billing/webhook` (unchanged)

---

## 🚫 Blocking — Must Do Before Launch

### 1. Email service (Resend)

Without this, password reset + email verification don't actually deliver. **5 minutes.**

- [ ] Sign up at [resend.com](https://resend.com) (free 3K/mo)
- [ ] Add `resumaker.co.il` as a sending domain
- [ ] Add the DNS records they show (SPF, DKIM) to Cloudflare
- [ ] Generate API key, save to `/Volumes/Server_Data/secrets/resumaker.env` as `RESEND_API_KEY=re_...`
- [ ] Set `EMAIL_FROM=hello@resumaker.co.il` in the same env

### 2. Push to GitHub

- [ ] `gh auth login` (browser flow)
- [ ] `cd /Volumes/Server_Data/code-server/workspace/resumaker`
- [ ] `gh repo create resumaker --private --source=. --remote=origin --push`
- [ ] Verify CI workflow runs on the first push
- [ ] Add repo secrets (Settings → Secrets → Actions): see [DEPLOY.md §2](./DEPLOY.md#2-configure-github-actions-secrets)

### 3. Database — production Postgres

You need a Postgres somewhere before the app can boot. Two options:

- **Option A** (cheapest): Supabase free tier — `https://supabase.com`, copy DATABASE_URL
- **Option B** (AWS-native): RDS via OpenTofu — see step 5
- [ ] Set `DATABASE_URL=postgres://...` in production env
- [ ] Run `pnpm --filter @resumaker/web db:migrate` to apply all 3 migrations

### 4. Sentry (optional but recommended)

Without this, you'll only see errors in app logs. **3 minutes.**

- [ ] Create project at [sentry.io](https://sentry.io) → Next.js
- [ ] Copy DSN, set `SENTRY_DSN=https://...` in production env

### 5. Decide your hosting path

**Path A — Vercel + Supabase (recommended for v1)**
Simplest, fast to launch, scales to a few thousand users free.

- [ ] Push to GitHub (step 2)
- [ ] Import repo at vercel.com
- [ ] Add all env vars from `.env.example`
- [ ] Set custom domain `resumaker.co.il`
- [ ] Vercel handles SSL automatically
- **Estimated time: 30 minutes** · **Cost: $0/mo until traffic grows**

**Path B — AWS EKS (your original plan)**
Best portfolio piece. EKS module + ArgoCD + ESO are now baked in.

- [ ] Bootstrap OpenTofu state: `./scripts/bootstrap-tofu-state.sh`
- [ ] Issue an ACM cert for `argocd.resumaker.co.il` in `il-central-1`
      then set `argocd_acm_cert_arn` in `infra/tofu/environments/prod/variables.tf`
- [ ] First apply (cluster + addons): `cd infra/tofu/environments/prod && tofu apply`
      Creates VPC, RDS, ElastiCache, S3, ECR, Secrets Manager, EKS, IRSA roles,
      ALB Controller, External Secrets, cert-manager, ArgoCD
- [ ] Update kubeconfig: `eval "$(tofu output -raw eks_kubeconfig_command)"`
- [ ] Verify ArgoCD up: `kubectl -n argocd rollout status deploy/argocd-server`
- [ ] Update `repoURL` placeholders in `infra/gitops/*.yaml` to your real repo URL
- [ ] Bootstrap GitOps: `kubectl apply -f infra/gitops/projects/resumaker.yaml && kubectl apply -f infra/gitops/root-app.yaml`
- [ ] Populate Secrets Manager (see step 12 below)
- [ ] Tag a release: `git tag v0.1.0 && git push --tags` → CI builds + ArgoCD syncs
- [ ] Point Cloudflare A record at the resulting ALB
- **Cost: ~$120-180/mo cluster + ~$40-80/mo data plane**

### 6. Cloudflare configuration

- [ ] Verify nameserver switch propagated: `dig NS resumaker.co.il @8.8.8.8` (should show Cloudflare)
- [ ] SSL/TLS → "Full (strict)"
- [ ] Security → Bot Fight Mode: on
- [ ] WAF → managed rules: on
- [ ] Page rule: `/api/*` → cache: bypass

---

## ⚠️ Should Do — Operational Hygiene

### 7. Make yourself admin

After your first sign-up:

```bash
psql $DATABASE_URL -c "UPDATE users SET role='admin' WHERE email='rotem@avigdol.com';"
```

### 8. Set up cron secret for purge job

- [ ] Generate: `CRON_SECRET=$(openssl rand -base64 32)`
- [ ] Add to env (Vercel or AWS Secrets Manager)
- [ ] Vercel reads from `vercel.json` automatically; for AWS configure k8s CronJob

### 9. Test the full happy path manually

- [ ] Sign up with a fresh email → check email arrives
- [ ] Verify email link works
- [ ] Sign in
- [ ] Paste a job description → generate resume
- [ ] Save the resume
- [ ] Download PDF (Hebrew + English)
- [ ] Edit the resume → check version history shows previous version
- [ ] Generate a cover letter, save it, view it
- [ ] Update profile name + language
- [ ] Sign out → forgot password → check email → set new password → sign in
- [ ] Delete account → verify cascade works

### 10. Smoke-test admin panel

- [ ] Visit `/admin` as admin
- [ ] Search/filter users
- [ ] Click into a user detail page
- [ ] Change a test user's role
- [ ] Verify session expiration on suspended user

---

## 🎯 Nice-to-Have — After Launch

### 11. OAuth providers

- Google: console.cloud.google.com → OAuth 2.0 Client ID → set `GOOGLE_CLIENT_ID/SECRET`
- GitHub: Settings → Developer settings → OAuth Apps → set `GITHUB_CLIENT_ID/SECRET`
- App will auto-show buttons when env vars are present

### 12. Populate AWS Secrets Manager

The pods read from `resumaker-prod/app` and `resumaker-prod/db-credentials`.
The latter is auto-populated by the RDS module. The former you create manually:

```bash
aws secretsmanager put-secret-value \
  --secret-id resumaker-prod/app \
  --secret-string "$(cat <<'EOF'
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "BETTER_AUTH_SECRET": "$(openssl rand -base64 48)",
  "RESEND_API_KEY": "re_...",
  "SENTRY_DSN": "https://...",
  "CRON_SECRET": "$(openssl rand -base64 32)",
  "GOOGLE_CLIENT_ID": "",
  "GOOGLE_CLIENT_SECRET": "",
  "GITHUB_CLIENT_ID": "",
  "GITHUB_CLIENT_SECRET": "",
  "STRIPE_SECRET_KEY": "",
  "STRIPE_PUBLISHABLE_KEY": "",
  "STRIPE_WEBHOOK_SECRET": "",
  "STRIPE_PRICE_PRO_MONTHLY": "",
  "STRIPE_PRICE_PRO_YEARLY": "",
  "STRIPE_PRICE_PREMIUM_MONTHLY": "",
  "STRIPE_PRICE_PREMIUM_YEARLY": ""
}
EOF
)"
```

External Secrets Operator syncs this into a K8s Secret `resumaker-app`
which the Deployment mounts as env vars. Refresh interval: 5 minutes.

### 13. Turn on payments

The billing layer is provider-agnostic. Same `lib/billing/`, same UI,
same DB — flip one env var to switch between Stripe and LemonSqueezy.
Right now `PAYMENT_PROVIDER=none` so the pricing page shows a waitlist
CTA and `/api/billing/*` returns 503.

#### Option A — **LemonSqueezy (recommended for v1)**

Merchant of Record: they handle VAT, invoicing, and tax everywhere.
**No Israeli business number required.** Higher fee (~5% + $0.50) but
zero setup cost, hours to launch.

1. Sign up at [lemonsqueezy.com](https://lemonsqueezy.com) (free)
2. Create a store, then 4 variants under one product:
   - **Pro Monthly** ₪39 — copy variant id
   - **Pro Yearly** ₪390 — copy variant id
   - **Premium Monthly** ₪99 — copy variant id
   - **Premium Yearly** ₪990 — copy variant id
3. Settings → API → generate key
4. Settings → Webhooks → add endpoint:
   `https://resumaker.co.il/api/billing/webhook/lemonsqueezy`
   Subscribe to: `order_created`, `subscription_created`, `subscription_updated`,
   `subscription_cancelled`, `subscription_expired`, `subscription_resumed`,
   `subscription_payment_failed`
5. Add all of these to AWS Secrets Manager (`resumaker-prod/app`):

   ```json
   {
     "LEMONSQUEEZY_API_KEY": "...",
     "LEMONSQUEEZY_STORE_ID": "12345",
     "LEMONSQUEEZY_WEBHOOK_SECRET": "...",
     "LEMONSQUEEZY_VARIANT_PRO_MONTHLY": "67890",
     "LEMONSQUEEZY_VARIANT_PRO_YEARLY": "67891",
     "LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY": "67892",
     "LEMONSQUEEZY_VARIANT_PREMIUM_YEARLY": "67893"
   }
   ```

6. In `infra/helm/resumaker/values.prod.yaml` set:

   ```yaml
   env:
     PAYMENT_PROVIDER: lemonsqueezy
   ```

7. Push the change — ArgoCD syncs, pods restart with new env, payments live.

#### Option B — **Stripe (when you have עוסק מורשה or US LLC)**

Lower fees (2.9% + $0.30) but requires either an Israeli VAT-registered
business OR a US entity (Stripe Atlas ~$500 setup, ~$1-2k/yr ongoing).

1. Sign up at [stripe.com](https://stripe.com) (via Atlas if you don't have עוסק מורשה)
2. Create products + prices: **Pro Monthly ₪39**, **Pro Yearly ₪390**, **Premium Monthly ₪99**, **Premium Yearly ₪990**
3. Add to Secrets Manager:

   ```json
   {
     "STRIPE_SECRET_KEY": "sk_live_...",
     "STRIPE_PUBLISHABLE_KEY": "pk_live_...",
     "STRIPE_WEBHOOK_SECRET": "whsec_...",
     "STRIPE_PRICE_PRO_MONTHLY": "price_...",
     "STRIPE_PRICE_PRO_YEARLY": "price_...",
     "STRIPE_PRICE_PREMIUM_MONTHLY": "price_...",
     "STRIPE_PRICE_PREMIUM_YEARLY": "price_..."
   }
   ```

4. Stripe Dashboard → Developers → Webhooks → add endpoint:
   `https://resumaker.co.il/api/billing/webhook` (note: no `/stripe` suffix —
   the original Stripe handler kept its top-level path for backward compat)
5. Set `env.PAYMENT_PROVIDER: stripe` in `values.prod.yaml`
6. For Israeli invoicing: integrate **Greeninvoice** or **iCount** — both
   have webhooks that listen for Stripe's `invoice.paid` and auto-issue heshbonit

#### Switching providers later

User subscriptions remember which provider created them (`provider` column).
You can flip `PAYMENT_PROVIDER` from `lemonsqueezy` → `stripe` and:

- **New** subscriptions go through Stripe
- **Existing** LemonSqueezy subs keep working (portal still opens LS)
- Migrate gradually as users churn or upgrade

### 13. Monitoring + alerts

- AWS CloudWatch / Grafana dashboards (Prometheus stack in `monitoring/`)
- PagerDuty integration for SEV-0/1
- Cost Anomaly Detection (retry — AWS needed 24-48h post-account-creation)

### 14. Beta feature

The job-hunting beta we discussed — leave behind a `beta` flag for now.

---

## 🧯 Pre-Launch Sanity Checks

Run these locally just before the first deploy:

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker

# 1. All tests pass
pnpm -r test
# Expected: 116 unit + 16 E2E

# 2. Full typecheck
pnpm -r typecheck
# Expected: all 7 packages "Done"

# 3. No secrets in git
gitleaks detect --no-banner --source .
# Expected: "no leaks found"

# 4. Container builds clean
docker build -f apps/web/Dockerfile -t resumaker-web .
# Expected: image built without errors

# 5. Lint clean
pnpm -r lint || true
# Expected: warnings ok, errors not

# 6. OpenTofu validates
cd infra/tofu/environments/prod
tofu init -backend=false
tofu validate
# Expected: "configuration is valid"
```

---

## ✋ Things NOT to Forget

- **Don't push the `.env` file** (it's gitignored — verify with `git ls-files | grep .env`)
- **Anthropic API key in prod ≠ dev** — generate a separate one
- **`BETTER_AUTH_SECRET` must be ≥32 chars** (regenerate per environment)
- **First deploy: enable email verification** by setting `RESEND_API_KEY` (auto-triggers)
- **Set MFA on your own admin account** — AWS root + GitHub + Cloudflare

---

## 📞 If Things Go Wrong

- Cost spike: [docs/runbooks/cost-spike.md](./runbooks/cost-spike.md)
- LLM injection detected: [docs/runbooks/llm-injection-detected.md](./runbooks/llm-injection-detected.md)
- Database restore: [docs/runbooks/db-restore.md](./runbooks/db-restore.md)
- Key rotation: [docs/runbooks/key-rotation.md](./runbooks/key-rotation.md)
