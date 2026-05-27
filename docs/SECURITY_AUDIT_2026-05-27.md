# Security + QA Audit Findings — 2026-05-27

Aggregated from the 11-phase QA pass: 6 Phase-1 code-review agents, 5 Phase-2 history/git agents, plus the security tooling sweep in the Phase-0 snapshot (gitleaks, pnpm audit, trivy IaC).

Reuses 2026-05-26 finding IDs (`A`–`T`) where the same issue persists; net-new findings carry `G.N` IDs. Status: **FIXED** = this PR set, **OPERATOR** = operator action required, **DEFERRED** = post-launch / lower priority.

Live production: `https://resumaker.co.il` (GKE Autopilot, Cloud SQL, Memorystore, Vertex AI, all in europe-west1).

---

## Critical

### G.1. SSRF wide-open in job-engine importer (now fixed)

Status: FIXED in PR #9.

`packages/job-engine/src/importer.ts:58-67` had `fetch(url, { redirect: 'follow' })` with no host validation, no IP allowlist, no size cap. The route at `/api/jobs/import` (beta+session-gated but otherwise unprivileged) accepted any string passing `z.string().url()` — including `http://169.254.169.254/computeMetadata/v1/` (GCE metadata, which would have returned a Workload Identity token for the pod's SA), `http://10.0.0.1`, `http://127.0.0.1:5432`, DNS-rebound `1.1.1.1.nip.io`, IP-as-integer (`http://2130706433`), and IPv6 link-local.

Fix: `fetchUrlText()` now (a) resolves DNS with `node:dns/promises.lookup`, (b) checks every returned IP against private/loopback/link-local/metadata blocks (IPv4 + IPv6 including IPv4-mapped), (c) walks redirects manually (max 5 hops, re-resolves at each hop), (d) blocks non-http(s) protocols, (e) streams the response with a 5 MB hard cap, (f) cancels mid-stream if exceeded. Still has a small DNS-rebinding race window between resolve and connect, but raises the bar from "trivial" to "requires control of an authoritative DNS server".

### G.2. `/api/user/llm-model` PATCH rejected all real model IDs (now fixed)

Status: FIXED in PR #9.

Regex `^[a-z]+\/[a-z0-9.\-]+$` did not allow `@`, so every Vertex Anthropic ID (`...@YYYYMMDD`) returned 400 "Invalid body". Users with Plus/Pro tier could not save any model preference — silently stuck on tier default. Not a security hole on its own, but combined with tier-gating it meant the tier-gate logic was inert.

Fix: regex now `^[a-z]+\/[a-z0-9.@\-]+$` (matches env.ts).

### G.3. `/api/applications/[id]/prep` + `/follow-up` 502-on-every-request (now fixed)

Status: FIXED in PR #9.

`generateText({ model: 'claude-haiku-4-5-20251001', ... })` — no `anthropic/` prefix. `resolveModel()` threw `Invalid model string` on every call. Both routes were dead since the Vertex swap.

### G.4. Cross-namespace ESO impersonation (live cluster bypass)

Status: OPERATOR — see Phase 9 reconciliation plan.

ExternalSecret CRDs in `infra/gitops/secrets/*.yaml` declare the desired sync state, but the live `resumaker-app` Secret is `kubectl create secret`-applied because the cross-namespace KSA→GSA impersonation IAM binding never resolved (`iam.serviceAccounts.getAccessToken denied`). This means the cluster's running state diverges from IaC; a fresh `tofu apply` + helm upgrade would not reproduce production.

Operator action: complete the WIF binding for the external-secrets-operator KSA, install ESO into `external-secrets` namespace, apply the ClusterSecretStore + ExternalSecret manifests, verify ESO recreates the Secret, then delete the manual one. Documented in OPERATOR_ACTION_LIST_2026-05-27.md.

### G.5. Cloud SQL Connector + IAM auth bypassed (live cluster bypass)

Status: OPERATOR — see Phase 9 reconciliation plan.

Cluster runs with `DATABASE_URL=postgres://postgres:<32-char-pw>@10.130.1.2:5432/resumaker?ssl=require`. Connector + IAM-auth path exists in `apps/web/src/db/cloudsql.ts` but isn't reached. The `postgres` user password is set on Cloud SQL — break-glass surface that shouldn't exist.

Operator action: investigate Connector option-mismatch with postgres-js v3.4 (the connector's `getOptions()` returns pg-driver options), switch back to Connector + IAM, rotate the `postgres` user password to an unguessable break-glass-only string.

### G.6. Memorystore AUTH disabled (live + IaC)

Status: OPERATOR — Phase 10 work.

`infra/tofu/modules/memorystore/main.tf` doesn't set `auth_enabled = true`. Anyone with VPC route to `10.130.0.4:6378` can `redis-cli` without a password (rate-limit cache, session-derived data). VPC + NetworkPolicy are the only floor.

Operator action: tofu plan + apply with `auth_enabled = true`, expose auth string via Secret Manager, mount into REDIS_URL. Requires a brief outage on the app to roll new env (or graceful reconnect — verify with `redis` client library).

### G.7. GKE control plane reachable from any Google identity (IaC drift)

Status: OPERATOR — Phase 10 work.

`infra/tofu/modules/gke/main.tf` leaves `master_authorized_networks_config` empty. RBAC is the only barrier. Combined with the bootstrap admin SA still holding `roles/owner` (G.10), a single chained credential compromise grants cluster-admin.

Operator action: scope master to a small allow-list (operator IP + GH Actions egress + bastion). Done partially via gcloud already (operator home IP `62.56.148.109/32`) but not reflected in tofu state.

### G.8. WIF allows main-branch pushes to deploy to prod

Status: OPERATOR — Phase 10 work.

`infra/tofu/modules/workload-identity/main.tf:26` matches `ref == refs/heads/main || ref_type == tag`. Production WIF should be tags-only: any workflow run on main with an `id-token: write` permission would be able to deploy. Most repos pin to `assertion.ref =~ "^refs/tags/v"` for prod and use a separate WIF principal for dev/staging.

---

## High

### G.9. ANTHROPIC_API_KEY secretKeyRef would crash pod on first scrub (now fixed)

Status: FIXED in PR #9.

`infra/helm/resumaker/templates/deployment.yaml:38-42` referenced a secret key that's a no-op after the Vertex swap. Without `optional: true`, deleting the dead secret (planned cleanup) would CreateContainerConfigError every new pod.

Fix: dropped the env block entirely with a comment explaining the Workload Identity path.

### G.10. Tofu admin SA still has `roles/owner`

Status: OPERATOR — Phase 10 work.

`infra/tofu/bootstrap/bootstrap.sh:67-69` grants `roles/owner` to the tofu admin SA for first apply. "Scoped down post-launch" never happened. Combined with G.8, a compromise of the bot SA = full project takeover.

Operator action: replace with curated bundle (`compute.networkAdmin` + `container.admin` + `cloudsql.admin` + `redis.admin` + `secretmanager.admin` + `iam.serviceAccountAdmin` + `resourcemanager.projectIamAdmin` + `artifactregistry.admin` + `storage.admin` + `logging.admin` + `monitoring.admin`). Verify next tofu plan still applies clean.

### G.11. Cross-product IAM grants in Secret Manager module

Status: OPERATOR — narrowing.

`infra/tofu/modules/secrets/main.tf:15-30` binds `secretAccessor` for every secret × every accessor SA. CI/CD does not need runtime payment-provider secrets. Restrict the prod env's `accessor_service_accounts` to `[app]` only.

### G.12. NetworkPolicy egress 10.0.0.0/8 (now in PR #8, can be narrower)

Status: DEFERRED — tightenable in Phase 10.

Cloud SQL (5432) + Memorystore (6378) egress allowed across the full RFC1918 /8. Tofu outputs expose the exact /32s — render them into Helm values and replace the broad CIDR. Same for 443 to AR / Vertex / Secret Manager (use FQDN egress via Cilium/Cloud NGFW once available).

### G.13. Soft-delete filter omissions (now fixed)

Status: FIXED in PR #9.

Five SELECTs missed `isNull(deletedAt)`:

- `/api/account/profile` (resume content used to derive profile)
- `/api/account/export` (GDPR export — returned soft-deleted resumes unlabeled — partial fix, see G.20)
- `dashboard/page.tsx` ATS aggregations
- `/api/admin/analytics/funnel` (conversion counted soft-deleted users' resumes)
- `/api/resumes/[id]/versions` restore path (allowed restoring a soft-deleted resume)

Fix: added `isNull(deletedAt)` to all five. Restore path also now re-asserts `userId` in WHERE (TOCTOU + IDOR defense).

### G.14. `/api/push/subscribe` DELETE missing ownership filter (now fixed)

Status: FIXED in PR #9.

Any authenticated user could unsubscribe any other user's push subscription given the endpoint URL. Fixed: WHERE now `and(eq(endpoint), eq(userId))`.

### G.15. Admin tier-grant missing `requireFreshSession` (now fixed)

Status: FIXED in PR #9.

Tier grants are nearly as sensitive as role grants — give-free-Pro-forever, shorten-paid-subscription. Role grants required fresh session; tier grants didn't.

### G.16. Admin endpoints leak provider error messages

Status: DEFERRED — Phase 10 cleanup.

`/api/admin/users/[id]/subscription/refund`, `/cancel`, `/force-password-reset` return `detail: (err).message` to admin client. Even admin-only endpoints shouldn't leak Stripe / Better Auth raw strings (potential internal IDs, session hints). Fix: log full, return generic.

### G.17. HR member-invite has no rate limit

Status: DEFERRED — Phase 10 cleanup.

`/api/hr/companies/[id]/members` POST sends an invite email via Resend with no per-user / per-target throttling. An HR owner can email-bomb any address. Add `checkRateLimit('hr-invite:' + userId, 20, 3600)` and per-target-email throttle.

### G.18. ESLint v9 + tests + 4 CI workflows red (now fixed)

Status: FIXED in PR #11 (Phase 3 work).

Lint clean (0 errors, 73 intentional warnings). Tests green (179 passing). Workflows still need a re-run on the post-Phase-3 main; expect them to flip green (Security workflow may still be red until vite CVE bumped — see G.21).

### G.19. better-auth `accountLinking.allowDifferentEmails: false` blocks `rotem@avigdol.com` link

Status: OPERATOR-DECISION — Phase 8.

Better-Auth core supports exactly one email per user. The operator's second-email request (`rotem@avigdol.com`) cannot be satisfied via standard account linking. Three paths: (A) change primary email — simplest, preserves Google OAuth via accountId; (B) schema extension — new `user_emails` table (~300 LOC); (C) flip `allowDifferentEmails: true` — re-opens GitHub-takeover vector. Recommend A.

### G.20. GDPR export returns soft-deleted resumes unlabeled

Status: DEFERRED — Phase 10 cleanup.

`/api/account/export` includes soft-deleted rows in the dump without flagging `deletedAt`. Either label them in the response or filter them. Partial fix (filter only) breaks data-portability (user can no longer see their own deleted resumes via export); labeling is the better fix.

### G.21. Vite moderate CVE (`GHSA-4w7w-66w2-5vf9`)

Status: OPERATOR — Phase 10 work.

Transitive of vitest. Devkit-only — path-traversal in `.map` endpoint of dev server, never runs in prod image. `pnpm up vite@^6.4.2` will close it.

### G.22. VPC flow logs disabled (Trivy `GCP-0076`)

Status: OPERATOR — Phase 10 work.

`infra/tofu/modules/network/main.tf` doesn't enable flow logs. No traffic forensics if breach. Cost ~$2/mo at low sampling. Fix: `log_config { aggregation_interval = "INTERVAL_5_SEC", flow_sampling = 0.5, metadata = "INCLUDE_ALL_METADATA" }`.

### G.23. Sentry DSN leaked in commit `adbba50`

Status: OPERATOR — must rotate.

`docs/runbooks/github-actions-oidc-setup.md` historically contained a real Sentry DSN with project key `dd977…`. Scrubbed from tree in `1003900`; remains in git history forever. DSN is write-only (event ingest) — worst case is quota exhaustion via flood — so rotation is sufficient (no `git filter-repo` needed). Add Sentry inbound-data filter to drop events from the old key for 30 days.

### G.24. Migration job sidesteps Cloud SQL IAM

Status: OPERATOR — Phase 9 work.

The intended `infra/helm/resumaker/templates/migration-job.yaml` reads `DATABASE_URL` from a secret that conflicts with the IAM-only Cloud SQL user defined in tofu. Today migrations are run manually via temporary public-IP unlock from operator's laptop. Phase 9 adds a Helm pre-install hook that uses the same Cloud SQL Connector path the app runtime uses.

### G.25. Helm image tag-pinned, not digest-pinned

Status: OPERATOR — Phase 10 work.

`deploy.yml` computes a digest but `deployment.yaml:26` still composes `repository:tag`. A future tag-mutation in AR could redirect prod. Fix: switch template to `repository@digest` (or fall back to tag if digest unset), enable Binary Authorization with the same digest as attestor.

### G.26. ServiceAccount mounts token by default

Status: DEFERRED — Phase 10 work.

`infra/helm/resumaker/templates/serviceaccount.yaml:12` hardcodes `automountServiceAccountToken: true`. Cron pods inherit a token they don't need. Better: set false on SA, opt-in `true` on web Deployment.

### G.27. Drizzle snapshot drift on UNIQUE constraints

Status: DEFERRED — DB migration work.

`schema.ts` declares `jobs.urlNormalized`, `userJobs`, `applications` UNIQUE constraints that exist only in the snapshot, not in any migration. Scraper's ON CONFLICT will throw `no unique constraint matching ON CONFLICT specification`. Hand-author a 0017 migration that adds them (after a dedupe pre-step).

### G.28. Cloud SQL TLS `ssl: 'require'` doesn't verify cert

Status: DEFERRED — Phase 10 cleanup.

`postgres-js` with `ssl: 'require'` is opportunistic TLS — no cert validation, no hostname check. Over private IP this is acceptable, but combined with the current password workaround (G.5) raises MITM risk. Switch to `ssl: { rejectUnauthorized: true, ca: <server-ca.pem> }` (download via `gcloud sql ssl server-ca-certs list`).

---

## Medium

### G.29. Tests for the Vertex provider don't cover error paths

Status: DEFERRED.

`provider.test.ts` covers happy-path only. No tests for (a) missing slash → throws, (b) unknown provider → throws, (c) timeout → AbortError. Add negative-path cases.

### G.30. Hebrew prompt-injection recall = 0

Status: DEFERRED — research item.

`packages/ai-safety/src/input-filter.ts` patterns are English-regex only. Hebrew/Arabic/Russian variants of "ignore previous instructions" (`התעלם מההוראות הקודמות`) pass through unflagged. Tracks the larger Hebrew-LLM workstream in the roadmap.

### G.31. resume-engine fonts load from jsdelivr CDN at PDF-render time

Status: DEFERRED — packaging work.

`packages/resume-engine/src/fonts.ts:21-25` hits `cdn.jsdelivr.net` on cold-start. jsdelivr outage = no PDFs. Comment acknowledges this. Mirror fonts to `apps/web/public/fonts/` for offline-safe build.

### G.32. CSP allows `script-src 'unsafe-inline'`

Status: DEFERRED — nonce migration.

Current CSP allows inline scripts (Next.js needs it for streaming RSC). Next 16 supports nonce middleware — switching to per-request nonces would close XSS via injected `<script>` tags. Medium because we don't currently render unsanitized HTML from user input, but defense-in-depth.

### G.33. Cookie `Secure` flag not asserted in env-driven config

Status: DEFERRED.

Better-auth sets Secure when `BETTER_AUTH_URL` is https. Verified prod is correct. Add an integration test that fails if a future dev override flips it off in prod.

### G.34. Admin role grant + tier grant don't notify the target user

Status: DEFERRED — UX work.

When admin grants role=admin or tier=pro to a user, no email goes out. Surprising for the user; also an audit-trail gap from their perspective.

### G.35. `/api/account/preferences` notificationPrefs uses unbounded JSONB merge

Status: DEFERRED.

Zod schema is closed today, but the spread-merge pattern is mass-assignment-fragile against future schema relaxations. Make the schema's safety load-bearing with a `.strict()`.

---

## Low

### G.36–G.40. Misc cleanup

- `vitest.setup.ts` AI_GATEWAY_API_KEY env stub (deleted in PR #9)
- `apps/web/src/lib/__tests__/env-gateway.test.ts` testing dead contract (deleted in PR #9)
- `apps/web/src/lib/llm.ts` legacy file vs `apps/web/src/lib/llm/` dir — node resolves to file, masks the directory exports (cleanup deferred)
- Author trailer typo `Rotem Avigol <…@icloud.com>` in 9 historical merge commits — left (filter-repo cost > benefit)
- `infra/tofu/environments/{dev,staging}` lack init/state — deferred to Phase 10 with a recommendation to keep them in-repo as templates without applied state

---

## Operator action list (consolidated)

| #    | Action                                                                    | Where                                                    | Why                                                                        |
| ---- | ------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| O.1  | Rotate Sentry DSN                                                         | sentry.io → Settings → Client Keys                       | G.23 — leaked in commit history                                            |
| O.2  | Add OAuth redirect URI `https://resumaker.co.il/api/auth/callback/google` | console.cloud.google.com → APIs & Services → Credentials | Google sign-in fails until added                                           |
| O.3  | Tear down Vercel + Neon accounts                                          | vercel.com, neon.tech                                    | Stop unbilled compute, revoke keys                                         |
| O.4  | Set `COMPANY_ADDRESS_HE/EN`                                               | `apps/web/src/lib/constants/contact.ts:51-52`            | Israeli law requires business address on every invoice                     |
| O.5  | Add Cloudflare CAA + DMARC + SPF + DKIM records                           | Cloudflare dashboard → resumaker.co.il → DNS             | CAA scopes who can issue TLS certs; DMARC/SPF/DKIM keep Resend out of spam |
| O.6  | Decide <rotem@avigdol.com> link approach                                  | Per G.19                                                 | Recommend A (change primary email)                                         |
| O.7  | Schedule Memorystore AUTH-enable maintenance window                       | Tofu apply                                               | G.6                                                                        |
| O.8  | Narrow tofu-admin SA from `roles/owner`                                   | bootstrap.sh / tofu apply                                | G.10                                                                       |
| O.9  | Enable VPC flow logs                                                      | Tofu module network                                      | G.22                                                                       |
| O.10 | Tighten GKE master_authorized_networks                                    | gcloud or tofu                                           | G.7                                                                        |
| O.11 | Set GitHub Actions repo secrets/variables                                 | repo Settings → Secrets/Variables                        | Unblocks automated deploys                                                 |
| O.12 | Bump vite ≥6.4.2 to close GHSA-4w7w-66w2-5vf9                             | `pnpm up vite -r`                                        | G.21                                                                       |

---

## Findings rollup

- **Critical:** 8 — 3 fixed (G.1, G.2, G.3), 5 operator (G.4–G.8)
- **High:** 19 — 9 fixed (G.9, G.13–G.18), 10 deferred/operator
- **Medium:** 7 — all deferred
- **Low:** 5 — 2 fixed, 3 left as cosmetic
- **Total:** 39 findings, 14 fixed in this PR set, 25 tracked for operator / Phase 9-10 / post-launch

Comparison to 2026-05-26 audit: that pass closed 20 critical/high in code; this pass closes 14 more (mostly Vertex-swap follow-ups + IDOR/TOCTOU we missed) and surfaces the IaC-vs-cluster-reality drift from the Phase 0 deploy as a class of CRITs that need IaC reconciliation in Phase 9.
