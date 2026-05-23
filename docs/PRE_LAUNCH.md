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
Best portfolio piece, more setup.

- [ ] Bootstrap OpenTofu state: `./scripts/bootstrap-tofu-state.sh`
- [ ] Provision base infra: `cd infra/tofu/environments/prod && tofu apply`
  - This creates VPC, RDS, ElastiCache, S3, ECR, Secrets Manager
  - **You provide EKS separately** — recommend the community module:

    ```hcl
    module "eks" {
      source = "terraform-aws-modules/eks/aws"
      version = "~> 20.0"
      # ... see https://registry.terraform.io/modules/terraform-aws-modules/eks
    }
    ```

- [ ] Install ArgoCD on EKS
- [ ] Push container image to ECR (CI handles this on tag)
- [ ] Apply Helm chart: `helm install resumaker infra/helm/resumaker -f infra/helm/resumaker/values.prod.yaml`
- [ ] Point Cloudflare A record at ALB
- **Estimated time: 1-2 days first time** · **Cost: $80-150/mo**

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

### 12. Stripe (when you have business number)

- Heshbonit (חשבונית) integration via Greeninvoice / iCount
- Subscription product setup
- Wire `/api/billing/*` endpoints

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
