# Post-Launch Manual QA Guide

Run this checklist **immediately after each prod deploy and at launch** to verify every user-facing surface works end-to-end. Each section is a self-contained scenario you can run from a single browser session.

**Total time:** ~60-90 minutes for a full pass.

**Test account discipline:**

- Create dedicated test accounts: `qa+free@yourdomain.com`, `qa+plus@yourdomain.com`, `qa+pro@yourdomain.com`, `qa+hr@yourdomain.com`, `qa+admin@yourdomain.com`. Promote them via the dashboards / scripts below; reuse them every run so you can compare state across deploys.
- For paid-tier tests use Stripe / LemonSqueezy **test mode** (test cards `4242 4242 4242 4242` etc.) — never run a real charge against a QA account.
- Reset tier between runs by manually setting `subscriptions.tier` back to `free` in the DB if needed.

**Reporting bugs:**

For each failure, capture:

- URL + timestamp
- Browser console errors (F12 → Console)
- Network tab response body for the failing request
- Screenshot
- Which test account
- Steps to reproduce

File against a tracking system (Linear / GitHub Issues) with the label `post-deploy-qa`.

---

## Section A — Anonymous user (not logged in)

A1. **Marketing pages load**

- [ ] `/` (home) — hero renders, no console errors
- [ ] `/he` (Hebrew home) — RTL layout intact, all strings translated (no `marketing.hero.title` literal keys showing)
- [ ] `/en` (English home) — LTR layout, English strings
- [ ] `/pricing` — three tier cards (Free / Plus / Pro), prices in NIS, "per month" / "per year" toggle works
- [ ] `/examples` — sample resumes render with content
- [ ] `/privacy`, `/terms` — load, contain expected legal text

A2. **Auth flows from cold**

- [ ] `/login` — page loads, OAuth buttons (Google, GitHub if enabled) visible, email/password form visible
- [ ] `/signup` — same
- [ ] Sign up with email/password → verification email arrives in <60s → click link → lands in dashboard
- [ ] Log out → log back in with email/password → lands in dashboard
- [ ] "Forgot password" → email arrives → reset link works → new password accepted
- [ ] OAuth sign-in (Google): full round-trip → account created → dashboard

A3. **Cold tools (no auth required)**

- [ ] `/tools/ats-scanner` — paste a resume + JD → score returns. Throttle test: spam 11+ requests/min, see 429 on the 11th.
- [ ] `/tools/salary-estimator` — submit a role + location → estimate returns

A4. **Negative path**

- [ ] Visit `/admin` directly → returns 404 (not 403 — security-through-obscurity is intentional)
- [ ] Visit `/api/admin/users` directly → 401 or 404 (depending on whether session exists)
- [ ] Visit `/api/cron/purge` without bearer token → 401

---

## Section B — Free tier user (regular)

Pre-conditions: logged in as `qa+free@…`, `subscriptions.tier='free'`.

B1. **Dashboard**

- [ ] `/dashboard` loads, shows quota meter (0/3 generations today, 0/2 resumes total, 0/1 cover letter this month)
- [ ] Header avatar dropdown works → Account, Settings, Sign out
- [ ] Recent resumes section is empty (or shows seed)

B2. **Resume builder — basic mode**

- [ ] `/builder` → basic mode by default
- [ ] Paste JD → fill form → submit → resume generates in <30s → preview pane shows result
- [ ] "Save" → resume row created, redirect to `/resumes/[id]`
- [ ] Generations quota now shows 1/3

B3. **Resume builder — advanced mode (post-builder-rework)**

- [ ] Toggle to advanced → live editor + preview pane visible
- [ ] Add an Experience → MM/YYYY pickers work → "is current" toggle → Save → flash green
- [ ] Add a Project with tech tags (comma-typed) → tags chip-ify on enter
- [ ] Drag-to-reorder Experience entries → order persists after page refresh
- [ ] Per-bullet "✨ rewrite" button → bullet replaced → undo toast appears
- [ ] Summary "Rewrite for this JD" button → summary updates

B4. **AI engine picker (should be LOCKED for free)**

- [ ] `/settings` → AI tab → only Claude Haiku is selectable; all other models show Lock icon + "Plus or Pro only"
- [ ] Try clicking Sonnet card → toast "Plus or Pro only" appears, no PATCH made (check Network tab)

B5. **Hit the quota wall**

- [ ] Generate 3 resumes in one day → 4th attempt returns 402 with `code: 'TIER_LIMIT'`
- [ ] UI shows the upgrade prompt with `reasonKey` translated

B6. **Cover letter (1/month for free)**

- [ ] Create 1 cover letter → succeeds
- [ ] Attempt 2nd → 402, `reasonKey: 'billing.gate.cover_letter_limit'`

B7. **Templates**

- [ ] Free user sees ONLY Modern template available; Classic and Minimal show lock badge
- [ ] PDF export works for Modern

B8. **Account settings**

- [ ] Profile tab: change name → persists after reload
- [ ] Security tab: enroll TOTP 2FA → entered code accepted → backup codes shown
- [ ] Sessions tab: see your current session → revoke another session if multiple devices
- [ ] Notifications tab: toggle email opt-in → reload → still toggled
- [ ] Regional tab: change timezone → time displays adjust
- [ ] AI tab: shows Haiku as selected (no other choice)
- [ ] Data tab: "Download my data" → JSON dump downloads (verify it contains resumes + generations)
- [ ] Danger tab: "Delete my account" requires re-auth → soft-deletes the row (verify in DB: `deleted_at` is set, NOT removed)

---

## Section C — Plus tier user

Pre-conditions: logged in as `qa+plus@…`. Either purchase via test mode, or manually set `subscriptions.tier='plus'` + `status='active'`.

C1. **Plus tier upsell paths cleared**

- [ ] Dashboard quota: 20/day generations, 10 resumes total, 5 cover letters/month
- [ ] All 3 templates available (Modern, Classic, Minimal)

C2. **AI engine picker (UNLOCKED)**

- [ ] `/settings` → AI → 4 models selectable: Haiku, Sonnet (recommended badge), Gemini 2.5 Pro, GPT-5
- [ ] Click Gemini → toast "Saved" → reload → Gemini still selected (Check icon)
- [ ] Generate a resume → verify in the `generations` table that `model = 'google/gemini-2.5-pro'` for this user's latest row
- [ ] Switch back to Sonnet → next generation should record `model = 'anthropic/claude-sonnet-4-6'`

C3. **Plus-locked features**

- [ ] LinkedIn import → button is enabled (was locked for free)
- [ ] ATS scoring shows full breakdown (not just basic)
- [ ] Branding removal: PDF export does NOT contain Resumaker watermark

C4. **Opus is still locked**

- [ ] Settings → AI → Opus card shows Lock icon
- [ ] Attempt PATCH `/api/user/llm-model { "llmModel": "anthropic/claude-opus-4-7" }` directly via curl/devtools → 402

C5. **Billing**

- [ ] `/account/billing` → see active subscription, renewal date, payment method
- [ ] Update payment method → succeeds (test card update)
- [ ] Download invoice for last cycle → PDF downloads

C6. **Cancellation flow**

- [ ] Cancel subscription → marked `status='canceled'` with `currentPeriodEnd` set
- [ ] Until period end: tier remains `plus` (grace period). Verify a generation still works.
- [ ] After backdating `currentPeriodEnd` to past (or waiting): tier reverts to `free`.

---

## Section D — Pro tier user

Pre-conditions: logged in as `qa+pro@…`. Tier = pro.

D1. **Pro caps**

- [ ] Generations / resumes / cover letters all show **unlimited** in UI
- [ ] Generate 50 resumes in one day → no quota errors

D2. **Opus unlocked**

- [ ] Settings → AI → all 5 models including Opus selectable
- [ ] Pick Opus → save → generate → row has `model = 'anthropic/claude-opus-4-7'`

D3. **Multi-language export**

- [ ] Generate a Hebrew resume → export as English (translate flow if enabled) → output is grammatically correct English

D4. **Priority support**

- [ ] Support ticket form: Pro users see "Priority response" badge

---

## Section E — HR user

Pre-conditions: logged in as `qa+hr@…`, has `company_members.role='recruiter'` or `'admin'` in a company.

E1. **HR dashboard**

- [ ] `/hr` → company-scoped dashboard
- [ ] Job listings page → list of company's job postings
- [ ] Create a new job posting → fill form → publishes (or saves as draft)
- [ ] Edit existing job → saves
- [ ] Archive a job → no longer surfaces in candidate searches

E2. **Bulk import**

- [ ] CSV bulk import → upload sample CSV (max 500 rows) → all rows ingested
- [ ] Bad CSV (missing column) → row-level error report, no partial import
- [ ] Try uploading 501 rows → rejected with clear error

E3. **Company management**

- [ ] Invite teammate by email → invite email sent
- [ ] Accept invite (as the invited user) → joined to company with `recruiter` role
- [ ] Remove a teammate → they lose access

E4. **HR is NOT admin**

- [ ] Visit `/admin` → 404 (HR ≠ admin)
- [ ] HR user trying admin API → 404

---

## Section F — Admin user

Pre-conditions: logged in as `qa+admin@…`, `users.role='admin'` (use `scripts/grant-admin-gcp.sh prod email`).

F1. **Admin dashboard access**

- [ ] `/admin` returns 200 (not 404 — admin sees the panel)
- [ ] Sub-pages: `/admin/users`, `/admin/coupons`, `/admin/audit`, `/admin/maintenance`, `/admin/broadcast`, `/admin/analytics` all load

F2. **User management**

- [ ] `/admin/users` → search by email finds users
- [ ] `/admin/users/[id]` → see user profile, resumes count, subscription tier, audit log
- [ ] Promote a test user to `hr` role → they get HR pages on next sign-in
- [ ] Toggle their `jobHuntBeta` feature flag → they get/lose `/jobs` access
- [ ] Soft-delete a user → row.deletedAt set, user can't sign in

F3. **Re-auth required for role changes**

- [ ] Without re-auth (>15 min old session): role change is rejected, prompts to re-authenticate
- [ ] With fresh re-auth: change succeeds, audit log entry created

F4. **Coupons**

- [ ] Create a 50% off coupon for the Plus monthly price → save
- [ ] Apply coupon at checkout (as a different test user) → discounted price
- [ ] Coupon hits its max_redemptions limit → next redemption rejected

F5. **Maintenance mode**

- [ ] Toggle maintenance mode ON → all non-admin users see maintenance banner / are blocked
- [ ] Admin can still access everything
- [ ] Toggle OFF → normal traffic resumes

F6. **Broadcast email**

- [ ] Draft a broadcast → preview HTML → send to a small list (1 test email)
- [ ] Email arrives, looks correct (header, footer, unsubscribe link works)

F7. **Audit log**

- [ ] `/admin/audit` → see entries for all the actions just taken
- [ ] IPs in the audit log are HMAC-hashed (NOT raw IPs)
- [ ] Filter by action type, by date → works

F8. **Impersonation (if enabled)**

- [ ] Click "View as user" → enters impersonation session
- [ ] Banner across top shows "Impersonating qa+free@... [Exit]"
- [ ] All actions during impersonation are logged with `impersonation_sessions` row
- [ ] Exit → returns to admin session

---

## Section G — Cross-cutting

G1. **i18n**

- [ ] Every page tested above also loads in `/he/…` (Hebrew, RTL)
- [ ] Spot-check 5 pages: no English fallback strings appear in Hebrew mode

G2. **Dark mode**

- [ ] Toggle dark mode (header pill) → all pages stay readable
- [ ] System theme: matches OS preference
- [ ] Theme choice persists across reloads + new tabs

G3. **Mobile**

- [ ] Open on a phone (or DevTools mobile emulator) → navigation collapses to hamburger / drawer
- [ ] Resume builder advanced mode → editor + preview as a tab pair, not split

G4. **Performance smoke**

- [ ] Lighthouse on `/` (mobile, slow 4G): LCP < 2.5s, no console errors
- [ ] Largest endpoint (`/api/resumes/generate`) p95 < 30s

G5. **Observability**

- [ ] Sentry: trigger a test error (visit `/api/test/error` if exists, or break a known endpoint) → error lands in Sentry within 1m
- [ ] GCP Cloud Logging: log lines from a pod include the request id, no PII

G6. **Email deliverability**

- [ ] DMARC + SPF + DKIM passing for `noreply@resumaker.co.il`. Run: send an email via Resend → check headers on the receiving end → all 3 say `pass`.

---

## Section H — Cron + scheduled jobs

H1. **Verify enabled crons in cluster**

```bash
kubectl get cronjobs -n resumaker
# Expect: resumaker-purge, resumaker-onboarding-emails, resumaker-push-notifications
# scrape-jobs disabled until Track 2
```

H2. **Force a one-off run of each**

```bash
for c in resumaker-purge resumaker-onboarding-emails resumaker-push-notifications; do
  kubectl create job --from=cronjob/$c $c-manual -n resumaker
  kubectl logs job/$c-manual -n resumaker
done
```

- [ ] `purge`: deletes users with `deleted_at` older than 30d, drops expired sessions + tokens, trims audit_log
- [ ] `onboarding-emails`: sends to users who signed up in last 7d and haven't generated a resume
- [ ] `push-notifications`: fires due notifications to subscribed users (check the `push_subscriptions` table)

---

## Section I — Backup + disaster recovery dry run

Once a quarter, not after every deploy.

- [ ] Verify Cloud SQL automated backups exist: `gcloud sql backups list --instance=<instance> --project=resumaker-prod` shows daily snapshots
- [ ] Restore the latest backup into a NEW Cloud SQL instance: `gcloud sql backups restore <backup-id> --restore-instance=resumaker-prod-restore-test --project=resumaker-prod`
- [ ] Connect to the restored instance → run a sanity query → data matches expectations
- [ ] Tear down the restore instance: `gcloud sql instances delete resumaker-prod-restore-test --project=resumaker-prod`

---

## Done?

Walk through the failures (if any). For each:

1. File an issue
2. Hot-fix or rollback to last green deploy (`kubectl rollout undo deploy/resumaker -n resumaker` or ArgoCD revert)
3. Re-run the failing section after the fix

If all green: tag the commit `qa-pass-YYYY-MM-DD` and ship traffic.
