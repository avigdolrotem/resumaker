# Operator Handoff — Q2 Roadmap (Multi-AI + GCP Migration)

Two branches are ready for you to take to production. Everything in here is **manual work that a subagent cannot do for you** — account setup, billing, API keys, DNS, deploy buttons.

Branches:

- `feat/multi-ai-3a` — Multi-AI provider abstraction (Track 3A). 21 commits. Code-complete, tested, typechecked. Awaiting your review + merge.
- `feat/gcp-migration` — GCP IaC + app integration (Track 1, Phases 0-4 + 6-8). 22 commits. Phases 5 (first apply) and 9 (cutover) need you.

---

## 1. Branch logistics

### Push both branches

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
git push -u origin feat/multi-ai-3a
git push -u origin feat/gcp-migration
```

### Open PRs

```bash
gh pr create --base main --head feat/multi-ai-3a \
  --title "Multi-AI provider abstraction (Track 3A)" \
  --body "$(cat <<'EOF'
## Summary
- New `lib/llm/` provider wrapper over Vercel AI Gateway + AI SDK v6
- All 13 Anthropic SDK call-sites migrated; `@anthropic-ai/sdk` dropped from both packages
- `users.llm_model` column + `GET/PATCH /api/user/llm-model` route
- Settings tab "AI engine" with tier-gated picker (Plus/Pro)
- 52 tests, typecheck clean

See `docs/superpowers/plans/2026-05-25-multi-ai-3a.md` for the full plan.
EOF
)"

gh pr create --base main --head feat/gcp-migration \
  --title "GCP migration — IaC + app integration (Track 1 Phases 0-4 + 6-8)" \
  --body "$(cat <<'EOF'
## Summary
- 8 Tofu modules under `infra/tofu/modules/gcp/*` (network, workload-identity, secrets, cloudsql, memorystore, gcs, artifactregistry, gke)
- 3 env wirings (dev/staging/prod-gcp) — all `tofu validate` green
- Cloud SQL Connector + IAM auth path in `apps/web/src/db/`
- `deploy-gcp.yml` workflow; `infra.yml` matrix extended for GCP
- Helm value overlays for GKE Ingress + ExternalSecrets + WIF SAs
- Bootstrap script for one-time gcloud setup

Phases 5 (first apply) and 9 (cutover) are operator-driven — see `docs/OPERATOR_HANDOFF.md`.
EOF
)"
```

### Recommended merge order

1. **Merge `feat/multi-ai-3a` first**. It's app code that works on the current AWS-less / Vercel+Neon stack. Lower risk; ships an immediately user-visible feature (the picker).
2. **Then `feat/gcp-migration`**. IaC + Cloud SQL plumbing. Doesn't activate until you populate `GCP_CLOUD_SQL_INSTANCE` in Vercel env, so merging it is safe.

There is one orphan commit (`edf6001` — the GCP design spec) on the `feat/multi-ai-3a` branch from a mid-session mistake. The same spec content also lives on `feat/gcp-migration` at `8e150f5`. When you merge both, git will dedupe (identical patches). No action required.

---

## 2. Prerequisites you need to install

| Tool                     | Purpose                             | How                                                |
| ------------------------ | ----------------------------------- | -------------------------------------------------- |
| `gcloud` CLI             | All GCP project + IAM operations    | <https://cloud.google.com/sdk/docs/install>        |
| `gke-gcloud-auth-plugin` | kubectl auth to GKE                 | `gcloud components install gke-gcloud-auth-plugin` |
| `tofu` (OpenTofu)        | IaC apply                           | <https://opentofu.org/docs/intro/install/>         |
| `vercel` CLI             | Vercel project + env management     | `pnpm add -g vercel`                               |
| `kubectl`                | K8s ops post-apply                  | `gcloud components install kubectl`                |
| `gh` CLI                 | Push PRs, secrets                   | <https://cli.github.com/>                          |
| `cloud-sql-proxy`        | Local DB connections for migrations | `gcloud components install cloud-sql-proxy`        |

Authenticate the relevant ones:

```bash
gcloud auth login
gcloud auth application-default login
vercel login
gh auth login
```

---

## 3. GCP account setup

### 3.1 Create / pick a billing account

You said you're using the **$300 GCP free trial**. Activate it at <https://console.cloud.google.com/billing/onboarding> if you haven't already.

```bash
gcloud billing accounts list
# Note the ACCOUNT_ID of your trial (it will have status 'open').
export BILLING_ACCOUNT_ID="01ABCD-234567-89EFGH"  # YOUR value
```

### 3.2 (Optional) Organization

If you have a GCP organization (e.g. a Workspace domain), get its ID:

```bash
gcloud organizations list
export ORG_ID="<numeric-org-id>"
```

For a personal Google account with no org, leave `ORG_ID` unset.

### 3.3 Run the bootstrap script

Provisions the projects, links billing, enables APIs, creates state buckets, creates the Tofu admin SA.

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/infra/tofu/bootstrap
chmod +x bootstrap.sh  # if not already
./bootstrap.sh dev
./bootstrap.sh staging
./bootstrap.sh prod
```

Each takes ~30-60 seconds. Re-run-safe if any step fails midway. Total burn: $0 — these are all metadata operations.

Verify:

```bash
gcloud projects list --filter="name:resumaker-*"
# Should show 3 projects: resumaker-dev, resumaker-staging, resumaker-prod

gcloud storage buckets list --filter="name:resumaker-*-tfstate"
# Should show 3 state buckets
```

---

## 4. Vercel project setup

You need 1-3 Vercel projects depending on how much env separation you want. Recommended: one project per env (matches GCP). Alternatively, a single prod project is fine if you don't want preview deploys against staging-gcp.

### 4.1 Find / create the Vercel team + project IDs

```bash
vercel teams list
# Note your team id (e.g. team_abcd1234)
export VERCEL_TEAM_ID="team_..."

vercel project ls
# Note the project_id of each Vercel project (e.g. prj_xyz789)
# Resumaker probably already has at least one. Pick the prod one for now.
```

### 4.2 Populate the per-env Tofu vars

For each env:

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/infra/tofu/environments/dev-gcp
cat > terraform.tfvars <<EOF
vercel_team_id    = "$VERCEL_TEAM_ID"
vercel_project_id = "prj_..."  # your dev Vercel project id (or prod's if you only have one)
EOF
```

Repeat for `staging-gcp/` and `prod-gcp/`. The `terraform.tfvars` files are gitignored — they stay local to your machine.

---

## 5. API keys + external services to provision

These are values you'll push into GCP Secret Manager after `tofu apply` so the app can read them via ExternalSecrets.

| Secret in Secret Manager      | Where to get it                                                                                                      | Required for                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `anthropic-api-key`           | <https://console.anthropic.com/settings/keys> — can be optional after `feat/multi-ai-3a` since the gateway covers it | Resume gen (legacy direct path)        |
| `ai-gateway-api-key`          | <https://vercel.com> → AI Gateway → API Keys                                                                         | All LLM calls via the new gateway path |
| `better-auth-secret`          | `openssl rand -base64 48`                                                                                            | Sessions + cookies                     |
| `ip-hash-salt`                | `openssl rand -base64 48`                                                                                            | Audit log IP hashing                   |
| `cron-secret`                 | `openssl rand -base64 48`                                                                                            | Vercel cron auth                       |
| `resend-api-key`              | <https://resend.com> → API Keys                                                                                      | Transactional + marketing email        |
| `sentry-dsn`                  | <https://sentry.io> → Settings → Client Keys                                                                         | Error tracking                         |
| `vapid-private-key`           | `pnpm exec web-push generate-vapid-keys` (in apps/web) — also save the PUBLIC key separately                         | Push notifications                     |
| `stripe-secret-key`           | <https://dashboard.stripe.com/apikeys>                                                                               | If using Stripe                        |
| `stripe-webhook-secret`       | Stripe dashboard → Developers → Webhooks → reveal signing secret                                                     | Stripe webhook verification            |
| `lemonsqueezy-api-key`        | <https://app.lemonsqueezy.com/settings/api>                                                                          | If using LemonSqueezy                  |
| `lemonsqueezy-webhook-secret` | LemonSqueezy dashboard → Webhooks → signing secret                                                                   | LS webhook verification                |
| `firecrawl-api-key`           | <https://firecrawl.dev> → API Keys                                                                                   | JD URL parsing (optional)              |

For prod values, generate fresh secrets — don't reuse anything from dev/Neon. After `tofu apply` populates the empty Secret Manager entries, push values:

```bash
echo -n "<value>" | gcloud secrets versions add anthropic-api-key \
  --data-file=- --project=resumaker-prod
# repeat for each
```

Or write a one-shot helper that pulls from `vercel env pull` and pushes — saves time.

---

## 6. GitHub repo secrets

Add to `https://github.com/<owner>/<repo>/settings/secrets/actions`:

| Secret name    | Value                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `WIF_PROVIDER` | After Phase 5 apply: `tofu output -raw wif_github_provider` from `prod-gcp/` (works for all envs because the WIF pool trusts the repo) |

Existing AWS secrets (`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `AWS_ACCOUNT_ID`, `GH_DEPLOY_TOKEN`) can stay — the AWS workflow still references them but won't trigger anything since no AWS resources are applied.

---

## 7. Phase 5 — First `tofu apply` (dev-gcp)

### 7.1 Plan + apply

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/infra/tofu/environments/dev-gcp
tofu init
tofu plan -out=tfplan
# Review the plan — should show ~60-70 resources. No destroys.
tofu apply tfplan
```

Total time: ~15-25 minutes. GKE Autopilot takes 5-10 min; Cloud SQL takes another 5-10. Memorystore is fast.

Watch for the **`private_services_connection` resource** — if it gets stuck >5 minutes, the most common cause is the `servicenetworking.googleapis.com` API not being enabled (bootstrap.sh enables it, so this should be fine, but worth knowing).

### 7.2 Capture outputs

```bash
tofu output > ../../../docs/.dev-gcp-outputs.txt  # gitignored
```

Outputs you'll need later:

- `cloudsql_connection_name` — for the Vercel `GCP_CLOUD_SQL_INSTANCE` env var
- `app_service_account_email` — for the Vercel `GCP_CLOUD_SQL_IAM_USER` env var
- `wif_github_provider` — for the GitHub `WIF_PROVIDER` secret
- `cluster_kubectl_command` — to get a kubectl context

### 7.3 Validate kubectl access

```bash
$(tofu output -raw cluster_kubectl_command)
kubectl get nodes
# Expect 1-2 Autopilot-managed nodes
kubectl get namespaces
```

### 7.4 Populate dev secrets

```bash
# Quick helper — replace VALUES inline:
declare -A SECRETS=(
  ["anthropic-api-key"]="sk-ant-..."
  ["ai-gateway-api-key"]="..."
  ["better-auth-secret"]="$(openssl rand -base64 48)"
  ["ip-hash-salt"]="$(openssl rand -base64 48)"
  ["cron-secret"]="$(openssl rand -base64 48)"
  ["resend-api-key"]="re_..."
)
for k in "${!SECRETS[@]}"; do
  echo -n "${SECRETS[$k]}" | gcloud secrets versions add "$k" \
    --data-file=- --project=resumaker-dev
done
```

### 7.5 Run schema migrations against dev Cloud SQL

```bash
# Open a Cloud SQL Proxy tunnel
cloud-sql-proxy "$(tofu output -raw cloudsql_connection_name)" --port=15432 &
PROXY_PID=$!

# Run migrations as the IAM user
DATABASE_URL="postgresql://resumaker-app%40resumaker-dev.iam@localhost:15432/resumaker?sslmode=disable" \
  pnpm --filter @resumaker/web db:migrate

kill $PROXY_PID
```

Note: the username has `%40` URL-encoding the `@` between the SA name and project.

### 7.6 Sanity check

```bash
gcloud sql connect "$(tofu output -raw cloudsql_connection_name | cut -d: -f3)" \
  --user=resumaker-app --project=resumaker-dev
# In psql:
\dt
# Should show users, resumes, generations, etc.
```

Once dev is green, repeat the same flow for `staging-gcp/` and `prod-gcp/`. Total ~45 min for both.

---

## 8. Phase 9 — Production cutover

After `prod-gcp` is applied and prod secrets populated:

### 8.1 Set Vercel prod env vars

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/apps/web

vercel env add GCP_CLOUD_SQL_INSTANCE production
# Paste the prod cloudsql_connection_name when prompted
# Format: resumaker-prod:europe-west1:resumaker-pg-xxxx

vercel env add GCP_CLOUD_SQL_IAM_USER production
# Paste the prod app SA email: resumaker-app@resumaker-prod.iam

vercel env add GCP_CLOUD_SQL_DATABASE production
# Value: resumaker
```

**Important — Vercel OIDC**: Vercel mints OIDC tokens automatically (`VERCEL_OIDC_TOKEN`). The Cloud SQL Connector library picks them up via `google-auth-library`. No manual token wiring needed, BUT you must enable OIDC on the Vercel project:

```bash
# In the Vercel dashboard → your project → Settings → Security → OIDC Federation
# Toggle "OIDC Federation" ON
# Audience: https://vercel.com/<team-id>
```

### 8.2 Trigger redeploy

```bash
vercel deploy --prod
```

### 8.3 Smoke test

1. Visit <https://resumaker.co.il> (or your prod URL)
2. Sign up with a new email
3. Generate a tailored resume
4. Log out, log in
5. Verify in Cloud SQL:

   ```bash
   gcloud sql connect "<prod-instance-suffix>" --user=resumaker-app --project=resumaker-prod
   SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5;
   ```

If the user row exists in Cloud SQL — cutover complete.

### 8.4 Set up budget alerts

GCP Console → Billing → Budgets & alerts → Create budget for each project:

- `resumaker-prod`: $200/mo cap, alerts at 50%/75%/90%
- `resumaker-staging`: $100/mo cap, alerts at 75%/90%
- `resumaker-dev`: $50/mo cap, alerts at 90%

### 8.5 Suspend Neon after 7 days clean

Once you're confident prod is healthy:

1. Go to <https://console.neon.tech>
2. Pause the resumaker project (don't delete — keep as 30-day fallback)
3. Document the rollback (paste in this section under "8.6")

### 8.6 Rollback procedure (within 30 days)

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/apps/web
vercel env rm GCP_CLOUD_SQL_INSTANCE production
vercel env rm GCP_CLOUD_SQL_IAM_USER production
vercel env rm GCP_CLOUD_SQL_DATABASE production
# Re-enable the Neon project in the Neon dashboard
vercel deploy --prod
```

App resumes using `DATABASE_URL` (Neon). Any data written to Cloud SQL after cutover is lost in the rollback (you can dump it via `pg_dump` first if needed).

---

## 9. Cloudflare / DNS

**Current state**: Cloudflare proxies `resumaker.co.il` → Vercel. You don't touch this for Track 1, because the Next.js app stays on Vercel.

**When you'd touch it**: if you ever move the Next.js app from Vercel to GKE (NOT in Track 1's scope). Then you'd:

1. Provision a Google-managed certificate via the GKE Managed Certificate resource (Helm values already reference `resumaker-{env}-cert` — needs the `ManagedCertificate` CR in cluster).
2. Point Cloudflare DNS for `resumaker.co.il` at the GKE Ingress IP.
3. Keep Cloudflare in proxy mode for the edge cache + DDoS shield.

For now, **no DNS changes needed**. Vercel keeps serving HTML; only the DB backend moves.

If you want to expose the GKE cluster for a Track 2 worker URL (e.g. `worker.resumaker.co.il` for scrapers triggered by Vercel cron), then:

1. Get the GKE Ingress IP after a workload is deployed: `kubectl get ingress`
2. Add an A record in Cloudflare: `worker.resumaker.co.il` → `<ingress-IP>`, proxied.
3. The ManagedCertificate resource auto-provisions the SSL cert.

---

## 10. AWS situation

You never applied AWS Tofu. **No AWS resources exist.** No cleanup needed.

The AWS Tofu modules + the `infra/tofu/environments/{dev,staging,prod}/` directories stay in-repo as dormant fallback. If GCP credits run out and you want to fall back:

```bash
cd infra/tofu/environments/prod
# Update terraform.tfvars with AWS account id, region, etc
tofu init
tofu plan -out=tfplan
tofu apply tfplan
```

Then point Vercel back at the AWS RDS DB. ~1-2 days work. Has never been tested. Treat as last resort.

---

## 11. Things to verify before declaring success

- [ ] `feat/multi-ai-3a` merged to main. Vercel preview deploy of `main` works.
- [ ] `feat/gcp-migration` merged to main. Vercel preview deploy of `main` STILL works (the Cloud SQL path is opt-in — when `GCP_CLOUD_SQL_INSTANCE` is unset, it falls back to `DATABASE_URL` = Neon).
- [ ] `bootstrap.sh` ran for all 3 envs. `gcloud projects list` shows all 3.
- [ ] `tofu apply` succeeded against `dev-gcp`. `kubectl get nodes` shows Autopilot nodes.
- [ ] Schema migrations applied against dev Cloud SQL. `\dt` shows expected tables.
- [ ] Secrets populated in dev Secret Manager. `gcloud secrets list --project=resumaker-dev` shows 13 secrets.
- [ ] `tofu apply` for staging-gcp + prod-gcp succeeded.
- [ ] Vercel prod env vars set for `GCP_CLOUD_SQL_INSTANCE`, `GCP_CLOUD_SQL_IAM_USER`, `GCP_CLOUD_SQL_DATABASE`.
- [ ] Vercel OIDC federation enabled on prod project.
- [ ] Prod redeploy successful. Smoke test (signup → resume gen → DB query) passes against Cloud SQL.
- [ ] Budget alerts set on all 3 GCP projects.

---

## 12. Known issues + parked follow-ups

These came up during execution and are tracked but NOT shipping in these two branches:

### High-priority follow-ups

1. **Drizzle migration snapshot drift** (chip queued in the session). Migrations 0006-0016 are hand-authored because `pnpm db:generate` is broken against the drifted snapshot. Resync the snapshots so `db:generate` works again. Out-of-scope for both branches; do in its own PR before the next schema change.

2. **Local dev `.env`** for `apps/web/` needs `DEFAULT_LLM_MODEL=anthropic/claude-sonnet-4-6` (we already updated it for you on your machine, but document this in the README so future devs / new machines don't get bricked by the new `provider/model` regex).

### Lower-priority

1. **`pnpm lint` script is broken** — Next.js 16 removed `next lint`. Pre-existing on `main`. Replace `"lint": "next lint"` with `"lint": "eslint . --config eslint.config.mjs"` and migrate `.eslintrc.json` to flat config. Out-of-scope; pre-existing.

2. **`AIModelCard` graceful failure** — if `/api/user/llm-model` returns an error on load, the card silently locks all models. Add an error state with retry. Tracked in the 3A final review.

3. **`tierOrder` const duplicated** in three files (`lib/llm/resolve-model.ts`, `app/api/user/llm-model/route.ts`, `components/settings/ai-model-card.tsx`). Extract into `@/lib/billing/limits`.

4. **`resolveModelForUser` only on `/api/resumes/generate`** — fit-score, ats-scanner, salary-estimator routes use the locked fallback model. By design (cost discipline), but a Pro user paying for Opus won't see Opus everywhere. Re-evaluate post-launch.

5. **Unused `ANTHROPIC_API_KEY` in `env.ts`** — kept optional but no longer read. Remove once you're certain you'll never want it for ad-hoc scripts.

6. **`job-engine` package has zero LLM tests**. Functions are simple wrappers around `generateObject`; consider adding a smoke test that runs in CI.

---

## 13. Quick command cheat sheet

```bash
# Push branches
git push -u origin feat/multi-ai-3a feat/gcp-migration

# Bootstrap GCP
export BILLING_ACCOUNT_ID="..."
./infra/tofu/bootstrap/bootstrap.sh dev
./infra/tofu/bootstrap/bootstrap.sh staging
./infra/tofu/bootstrap/bootstrap.sh prod

# Apply dev env (replace dev → staging → prod for the others)
cd infra/tofu/environments/dev-gcp
tofu init && tofu plan -out=tfplan && tofu apply tfplan

# Connect kubectl to a cluster
$(tofu output -raw cluster_kubectl_command)

# Open a DB tunnel
cloud-sql-proxy "$(tofu output -raw cloudsql_connection_name)" --port=15432 &

# Run migrations against tunneled DB
DATABASE_URL="postgresql://resumaker-app%40resumaker-dev.iam@localhost:15432/resumaker?sslmode=disable" \
  pnpm --filter @resumaker/web db:migrate

# Populate a secret
echo -n "value" | gcloud secrets versions add SECRET_NAME --data-file=- --project=resumaker-dev

# Set Vercel env (per-env)
vercel env add GCP_CLOUD_SQL_INSTANCE production

# Trigger Vercel deploy
vercel deploy --prod

# Tear it all down (per project)
gcloud projects delete resumaker-<env>  # async — 30-day grace
```

---

## 14. Total cost estimate (full operation)

| Item                            | Cost                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| Bootstrap (gcloud metadata ops) | $0                                                                    |
| Initial `tofu apply` (3 envs)   | ~1 hour of GKE Autopilot + Cloud SQL spin-up — free trial covers this |
| Steady-state, all 3 envs        | ~$285-420/mo                                                          |
| Steady-state, prod only         | ~$95-140/mo                                                           |
| **Free trial cushion**          | ~3-4 weeks of all 3 envs OR ~2-3 months of prod-only                  |

Strategy: keep all 3 running for the launch window (~2 weeks), then suspend non-prod to extend the trial. Suspending Cloud SQL + Memorystore instances retains data + config; only compute stops billing.

---

Good luck. Slack/Linear me when you hit a snag and I'll help debug.

— Last updated 2026-05-26
