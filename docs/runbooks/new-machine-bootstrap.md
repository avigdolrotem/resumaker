# New Machine Bootstrap — Resumaker

> Written during the 2026-05-30 wind-down for the operator's machine migration. Run these steps top-to-bottom on a fresh macOS/Linux box and you'll have a working local dev environment + cluster access ready to ship.

The runbook covers only the **structural** setup. Real secret VALUES (`.env`, `.env.local`, `~/.config/gcloud/...`, SSH/GPG keys) are operator-transferred out-of-band — see [`MANUAL_TRANSFER`](#9-manual-transfer-checklist--what-the-runbook-cant-do) at the end.

---

## 1. Prereqs (install once)

| Tool              | Minimum      | Notes                                           |
| ----------------- | ------------ | ----------------------------------------------- |
| git               | any recent   | —                                               |
| `gh` (GitHub CLI) | 2.x          | for PR / issue ops                              |
| Node.js           | **≥ 22.0.0** | the `engines.node` constraint in `package.json` |
| pnpm              | **9.15.x**   | lockfile is `lockfileVersion: 9.0`              |
| Docker Desktop    | any recent   | for `rsm-pg` + `rsm-redis`                      |
| gcloud SDK        | latest       | with the `gke-gcloud-auth-plugin` add-on        |

macOS shortcut (Homebrew):

```bash
brew install git gh pnpm docker
brew install --cask google-cloud-sdk
# Required for `kubectl` to actually reach GKE — without this you get
# "exec: gke-gcloud-auth-plugin: executable file not found".
gcloud components install gke-gcloud-auth-plugin
# Node ≥ 22 via your runtime manager of choice:
brew install fnm && fnm install 22 && fnm use 22
```

### Gotcha #8 — `gke-gcloud-auth-plugin` PATH on macOS

`brew install --cask google-cloud-sdk` installs the binaries to `/opt/homebrew/share/google-cloud-sdk/bin`, which is **not** on `$PATH` by default. Every shell that wants `kubectl` against GKE needs:

```bash
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
```

Add it to `~/.zshrc` / `~/.bash_profile` permanently. Without it, `kubectl` fails with a cryptic "credential plugin not found" the first time you try a cluster command.

---

## 2. Auth to all the SaaS

```bash
gh auth login                                       # GitHub
gcloud auth login                                   # gcloud user auth (for the SDK)
gcloud auth application-default login               # ADC (for Vertex AI + local SDK clients)
gcloud config set project resumaker-497309
```

The ADC step is the one that's easy to miss — without it, any local code path that talks to Vertex (the Gemini route in the LLM resolver) fails with `Could not load the default credentials`.

---

## 3. Clone + install

```bash
git clone https://github.com/avigdolrotem/resumaker.git
cd resumaker
pnpm install
```

The repo is a pnpm workspace; `pnpm install` from the root pulls dependencies for every package + app.

---

## 4. Local stack — Postgres + Redis (`rsm-pg` + `rsm-redis`)

```bash
# Postgres: matches the password + db in apps/web/.env.local
docker run -d --name rsm-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=local \
  -e POSTGRES_DB=resumaker \
  postgres:15

# Redis (no TLS — local dev uses redis://, not rediss://)
docker run -d --name rsm-redis \
  -p 6379:6379 \
  redis:7
```

Verify both are up:

```bash
docker ps --filter "name=rsm-" --format 'table {{.Names}}\t{{.Status}}'
docker exec -i rsm-pg pg_isready -U postgres
docker exec -i rsm-redis redis-cli ping     # PONG
```

### Apply migrations to local

```bash
cd apps/web
pnpm db:migrate
```

This runs `drizzle-kit migrate` against the `DATABASE_URL` in `apps/web/.env.local` — i.e. the local `rsm-pg` container.

### Seed a test admin + a test free user for manual QA

```bash
PG() { docker exec -i rsm-pg psql -U postgres -d resumaker -v ON_ERROR_STOP=1 "$@"; }

# Sign up via the API so Better Auth hashes the password correctly,
# then promote / mark verified via DB so we don't need email click-through.
# Server must be running for this — see step 6.
TEST_PW="verylongpassword123"
for EMAIL in admin@test.local free@test.local; do
  curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$TEST_PW\",\"name\":\"$EMAIL\"}" \
    -o /dev/null -w "$EMAIL signup HTTP %{http_code}\n"
done
PG -c "UPDATE users SET email_verified=true WHERE email IN ('admin@test.local','free@test.local');"
PG -c "UPDATE users SET role='admin' WHERE email='admin@test.local';"
PG -At -c "SELECT email||' role='||role||' verified='||email_verified FROM users WHERE email LIKE '%@test.local';"
```

Output should be:

```
admin@test.local role=admin verified=t
free@test.local role=user verified=t
```

Both share password `verylongpassword123`.

---

## 5. `.env.local` — structure

The actual values come from your manual transfer (see §9). The KEY LIST you should expect in `apps/web/.env.local` (mirror of what's on the old machine):

```
NODE_ENV
APP_URL
NEXT_PUBLIC_APP_URL
BETTER_AUTH_URL
BETTER_AUTH_SECRET
DATABASE_URL          # postgres://postgres:local@localhost:5432/resumaker
REDIS_URL             # redis://localhost:6379
GCP_CLOUD_SQL_INSTANCE   # dummy on local — env.ts requires .min(1)
GCP_CLOUD_SQL_IAM_USER   # dummy on local
GOOGLE_VERTEX_PROJECT    # the real prod project — Vertex needs ADC
LOG_FORMAT=pretty
```

The canonical superset of every env var the app reads is in [`/.env.example`](../../.env.example) (root, production-oriented) and [`/apps/web/.env.example`](../../apps/web/.env.example) (local-dev-oriented). Use those as the structural reference if you ever lose `.env.local`.

---

## 6. Boot check

```bash
# from the repo root
pnpm dev
```

Wait a few seconds for the initial Turbopack compile, then:

```bash
curl -s http://localhost:3000/api/health/ready | jq .
```

Expected response:

```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "ok", "latencyMs": 1 },
    "redis": { "status": "ok", "latencyMs": 9 }
  }
}
```

If `database` is failing → migrations haven't run yet (back to §4). If `redis` is failing → `rsm-redis` isn't reachable (check `docker ps`).

---

## 7. Cluster access (kubectl → GKE prod)

```bash
gcloud container clusters get-credentials resumaker-prod \
  --region=europe-west1 \
  --project=resumaker-497309

kubectl config use-context gke_resumaker-497309_europe-west1_resumaker-prod
kubectl get pods -n resumaker -l app.kubernetes.io/name=resumaker
```

### Gotcha #8 (the other half) — `master_authorized_networks`

The GKE master is firewalled to a specific set of IP ranges (security audit finding G.7 — operator-managed). **If your new machine has a different external IP from the old one, the very first `kubectl` call will hang/timeout** — your IP isn't allowlisted yet.

Fix:

```bash
# 1. Find your new external IP.
MY_IP=$(curl -s https://ifconfig.me)
echo "Adding $MY_IP/32 to the GKE master allow-list"

# 2. Read the current set (so you don't accidentally clobber the others).
gcloud container clusters describe resumaker-prod \
  --region=europe-west1 \
  --format='value(masterAuthorizedNetworksConfig.cidrBlocks)'

# 3. Update — supply the union of the existing entries + your new IP.
#    Example with two pre-existing entries; replace `<old1>` and `<old2>`
#    with whatever the describe call returned (display-name=cidr_block).
gcloud container clusters update resumaker-prod \
  --region=europe-west1 \
  --master-authorized-networks="<old1>=A.A.A.A/32,<old2>=B.B.B.B/32,operator-laptop=${MY_IP}/32"
```

Allowlist updates propagate in ~30 seconds. After that, retry `kubectl get pods`.

When you retire the **old** machine's entry, do the same `--master-authorized-networks` update without it.

---

## 8. Secret rotation + post-rotation liveness

Secret rotation isn't part of bootstrap — it's an operator-initiated event when ready to invite real users. The full procedure lives in [`docs/runbooks/key-rotation-2026-05-28.md`](./key-rotation-2026-05-28.md) (the canonical "rotate every secret" runbook this session refined) — supersedes the older `key-rotation.md`.

After any rotation, verify these still work:

```bash
# Better Auth (sign-in path uses BETTER_AUTH_SECRET to validate cookies)
curl -s -X POST https://resumaker.co.il/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"<known-prod-account>","password":"<known-pw>"}' \
  -w "\nHTTP %{http_code}\n" | head -3
# Expect 200 + Set-Cookie: __Secure-resumaker.session_token=...

# Sentry (server-side errors) — trigger a benign 4xx and check it lands
# in the Sentry project. The /api/admin/audit anon call gives 401 + a
# 4xx breadcrumb without any state change.
curl -s -o /dev/null -w "anon admin -> %{http_code}\n" \
  https://resumaker.co.il/api/admin/audit

# Resend deliverability — fastest manual check is to send a verify
# email from prod sign-up to a mailinator address and confirm receipt.

# Google OAuth — sign in via the `Continue with Google` button in
# /sign-in and confirm the redirect round-trips back to /dashboard.
```

---

## 9. Manual transfer checklist — what the runbook can't do

Files that exist **only on the old machine** and that no automation can ship for you. Move each via password manager / encrypted USB / `scp` over a trusted channel — **not** via chat, cloud sync to an untrusted machine, or anything that touches a 3rd-party server you don't control.

| #   | What                                                                                | Path (old machine)                                                                                                                                             | Recovery on new machine                                                                          |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Operator's `.env`                                                                   | `/Volumes/Server_Data/code-server/workspace/resumaker/.env`                                                                                                    | `scp` the file. Confirm `chmod 600`.                                                             |
| 2   | Operator's `apps/web/.env`                                                          | `/Volumes/Server_Data/code-server/workspace/resumaker/apps/web/.env`                                                                                           | same                                                                                             |
| 3   | Local dev override                                                                  | `/Volumes/Server_Data/code-server/workspace/resumaker/apps/web/.env.local`                                                                                     | same                                                                                             |
| 4   | Claude Code project memory                                                          | `~/.claude/projects/-Volumes-Server-Data-code-server-workspace-resumaker/memory/` (incl. `MEMORY.md`, `feedback_collaboration.md`, `project_resumaker_ops.md`) | `rsync -av` the whole dir. Path on new machine adjusts to wherever you check the repo out.       |
| 5   | gcloud config + ADC                                                                 | `~/.config/gcloud/`                                                                                                                                            | Easier: re-run `gcloud auth login` + `gcloud auth application-default login` on the new machine. |
| 6   | SSH keys (GitHub push auth)                                                         | `~/.ssh/id_*`                                                                                                                                                  | `scp -p` preserving permissions, or generate a fresh keypair and re-add to GitHub.               |
| 7   | GPG/SSH signing keys (if any)                                                       | `~/.gnupg/`, `~/.ssh/allowed_signers`                                                                                                                          | `scp` or regenerate. Re-export public key to GitHub if regenerating.                             |
| 8   | Browser-saved sessions (GitHub, GCP console, Sentry, Resend, Stripe / LemonSqueezy) | Browser state                                                                                                                                                  | Just re-login on the new machine.                                                                |
| 9   | **OK to lose** — `rsm-pg` data                                                      | docker container ephemeral storage                                                                                                                             | Reproducible from `pnpm db:migrate` + the seed script in §4. **No dump needed.**                 |
| 10  | **OK to lose** — `rsm-redis` data                                                   | docker container ephemeral storage                                                                                                                             | Reproducible — empty Redis on first boot is fine; the app initialises its own keys.              |

After step 1–4, set permissions tight: `chmod 600 .env .env.local apps/web/.env apps/web/.env.local` so they're not group/world-readable.

---

## Cross-references

- Production state + rollback commands → [`docs/SECURITY_AUDIT_2026-05-27.md`](../SECURITY_AUDIT_2026-05-27.md) (G.4–G.8 + ESO; explicit operator actions)
- DB restore (if you ever need to recover prod from a backup) → [`db-restore.md`](./db-restore.md)
- Cost-spike investigation → [`cost-spike.md`](./cost-spike.md)
- LLM injection alert response → [`llm-injection-detected.md`](./llm-injection-detected.md)
- GitHub Actions OIDC ⇄ GCP WIF setup → [`github-actions-oidc-setup.md`](./github-actions-oidc-setup.md)
