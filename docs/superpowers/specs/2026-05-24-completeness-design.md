# Resumaker Pre-Launch Completeness — Design

> Single design doc covering the full set of work to take resumaker.co.il
> from "good Hebrew CV builder" to "complete, runnable, multi-persona
> product." Approved by user on 2026-05-24, sequence L1 → L7.

## Goal

Land all known launch blockers (security, core flows, Hebrew finish,
theme refresh, job-hunt beta port, HR + admin completeness) in one
sustained pass so the user can deploy and test in production end-to-end
without further iteration.

## Non-goals

- Building Stripe/LemonSqueezy MOR integrations from scratch (already done,
  just need to land checkout + welcome email)
- Mobile-native apps
- A separate landing site
- LinkedIn scraping (legal/ToS risk; rely on Serper snippets only)
- AI fine-tuning (Anthropic API is the model layer)

---

## L1 — Security CRITICAL + HIGH fixes

### Why first

Anything built on broken auth (HR role, impersonation, admin polish) is
wasted work. Auth + privacy fixes are also the cheapest to land while the
schema is still malleable.

### Changes

| Area             | File                                                                  | Change                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth linking    | `apps/web/src/lib/auth.ts`                                            | Add `account.accountLinking: { enabled: true, trustedProviders: ['google'], allowDifferentEmails: false }`                                 |
| Suspended role   | `apps/web/src/lib/auth.ts`                                            | Add `databaseHooks.session.create.before` that throws when `users.role === 'suspended'`                                                    |
| Session IPs      | `apps/web/src/db/schema.ts` + `auth.ts`                               | `databaseHooks.session.create.before` replaces `ipAddress` with `hashIp(ip)` before write. Migration backfills existing rows.              |
| GDPR export      | `apps/web/src/app/api/account/export/route.ts`                        | Add `cover_letters`, `resume_versions`, `subscriptions`, `ats_scores`, plus scrubbed `accounts` (no tokens) + `sessions` (hashed IPs only) |
| Session lifetime | `apps/web/src/lib/auth.ts`                                            | `session.expiresIn: 60*60*24*14` (14d absolute). New helper `requireFreshSession(maxAgeSec)`                                               |
| Freshness gate   | `account/delete/route.ts`, `billing/portal/route.ts`, password-change | Call `requireFreshSession(15*60)` — re-auth within 15min required                                                                          |
| Audit redaction  | `audit_log.metadata` writers                                          | Replace `targetEmail` with `targetUserId` only. Add cron to redact emails on existing rows older than 30d                                  |
| `requireAdmin()` | New `apps/web/src/lib/auth-guards.ts`                                 | Shared helper. Use in every admin route + page.                                                                                            |
| Env consistency  | `apps/web/src/lib/env.ts`                                             | Add `NEXT_PUBLIC_APP_URL` (url), `RATE_LIMIT_PER_USER_PER_HOUR` (int default 10). Replace `process.env.*` reads with `env.*`.              |

### Verification

- `pnpm -r typecheck` clean
- `pnpm -r test` clean (add unit tests for `requireAdmin`, suspended-role hook, freshness gate)
- Manual: sign up via Google with email that matches an existing password user → must fail
- Manual: suspend self via admin → sign out → sign in → must redirect with "suspended" message
- Manual: GDPR export → unzip → confirm every table present

---

## L2 — Core flow bugs

### Why second

Without these, no user can complete the basic loop (generate → save →
edit → delete → re-open). Cosmetic issues like theme don't matter if the
product is unusable.

### Changes

| #   | Issue                               | Fix                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No edit/delete UI for saved resumes | Add `DropdownMenu` to each `ResumeCard` with Edit (→ `/builder?id=X`), Duplicate, Rename, Delete (confirm dialog)                                                                                                                                                                                                                                                                                 |
| 2   | Dashboard cards link broken         | Builder reads `?id` query, calls `/api/resumes/[id]`, hydrates form. New "Save" updates instead of creates.                                                                                                                                                                                                                                                                                       |
| 3   | Cover letter sends empty profile    | `/cover-letters/new/page.tsx` fetches `/api/account/profile` on mount, passes name/email/skills to generate call                                                                                                                                                                                                                                                                                  |
| 4   | No template picker                  | Add `TemplatePicker` component (Modern / Classic / Minimal). Show lock icon + upgrade tooltip for locked-by-tier templates. Wire `templateId` through generate + PDF render.                                                                                                                                                                                                                      |
| 5   | Checkout disabled by default        | Document in PRE_LAUNCH that `PAYMENT_PROVIDER=lemonsqueezy` must be set before launch. Add validator check.                                                                                                                                                                                                                                                                                       |
| 6   | No post-payment email               | Webhook handler triggers `sendWelcomeEmail(user, tier)` via Resend after first successful subscription                                                                                                                                                                                                                                                                                            |
| 7   | Profile locale hardcoded `'he'`     | `useState<'he'\|'en'>(session.user.locale ?? 'he')`                                                                                                                                                                                                                                                                                                                                               |
| 8   | ATS scoring broken on URL           | Move `fetchAtsScore` out of `if (jd)` branch — fire whenever `parsedJd` exists (URL path returns parsed JD in response)                                                                                                                                                                                                                                                                           |
| 9   | Version history retention           | `/api/resumes/[id]/versions` filters by `createdAt > now - tier.versionHistoryDays*86400` (Infinity for Pro)                                                                                                                                                                                                                                                                                      |
| 10  | Pricing teaser dynamic CTA          | Homepage pricing section reads `checkoutReady` like `/pricing` does                                                                                                                                                                                                                                                                                                                               |
| 11  | "Import via AI prompt" option       | Profile + builder import dialog gets a 3rd tab next to "Upload PDF" and "LinkedIn URL": **"Get an AI prompt"** — shows a copy-button block with a structured prompt the user pastes into their own ChatGPT/Claude/Gemini session. Response comes back as JSON they paste into a second textarea here. We parse and pre-fill the profile. Lets users bring data from anywhere without us scraping. |

### Verification

- Manual click-through each persona (visitor, free, plus, pro, admin) on Vercel preview
- Vitest snapshot of `ResumeCard` with dropdown
- Playwright: generate → edit → save → reopen, must show edited content

---

## L3 — Hebrew/RTL finishing pass

### Changes

| File                                                | Change                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/[locale]/(app)/settings/page.tsx` | Wire `useTranslations('settings')`. Replace 25 hardcoded strings + 6 hardcoded toasts                                                          |
| `apps/web/src/app/[locale]/(app)/profile/page.tsx`  | Same — needs new `profile.*` namespace in he.json + en.json                                                                                    |
| `apps/web/src/app/[locale]/(app)/error.tsx`         | `useTranslations('errors.boundary')`                                                                                                           |
| `apps/web/src/app/[locale]/not-found.tsx`           | Fix the still-hardcoded `<p>Page not found</p>`                                                                                                |
| `apps/web/src/app/not-found.tsx`                    | Add minimal he/en switching based on `Accept-Language`                                                                                         |
| `packages/resume-engine/src/templates/minimal.tsx`  | Same RTL pattern as modern.tsx + classic.tsx — `flexDirection: 'row-reverse'` on header/highlights, `textAlign: 'right'` on page, padding swap |
| `apps/web/src/middleware.ts`                        | Read `users.locale` on session, if URL `[locale]` differs from preference → 302 to user's locale on first navigation                           |

### Verification

- Diff `he.json` and `en.json` — every key in one must exist in the other
- Render each PDF template in Hebrew test fixture, snapshot
- Manual: open settings + profile in /he and /en, every string changes

---

## L4 — Theme refresh (indigo → violet, slate neutrals)

### Approach

Single token swap via Tailwind v4 `@theme` block, propagates to every
component that uses semantic tokens. Custom colors hardcoded in
components get one find-replace pass.

### Changes

| File                                              | Change                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/globals.css`                    | `@theme` block: `--color-primary-*` (indigo scale), `--color-accent-*` (violet scale), `--color-surface-*` (slate scale). Map shadcn tokens (`--primary`, `--accent`) to new values. |
| `packages/resume-engine/src/templates/modern.tsx` | `accentColor` default `#7c3aed` (violet-600) instead of `#1d4ed8` (blue-700)                                                                                                         |
| `apps/web/public/icon.svg`                        | Re-color logo gradient to indigo→violet                                                                                                                                              |
| `apps/web/public/*.png`                           | Regenerate favicons + OG image with new palette via @resvg/resvg-js script                                                                                                           |
| `apps/web/src/components/hero.tsx` (or wherever)  | Replace `from-blue-* to-cyan-*` with `from-indigo-500 to-violet-600`                                                                                                                 |
| Marketing pages                                   | Audit for hardcoded blue → migrate to semantic tokens                                                                                                                                |

### Verification

- Manual: every page (marketing + app + admin) in both locales, both color modes — visually consistent
- Snapshot tests update for ResumeCard, PricingCard

---

## L5 — Job-hunt beta port

### Approach

Drizzle schema port + AI service port + UI port, gated behind
`users.featureFlags.jobHuntBeta` (default false). I enable for myself
in admin panel. Public launch happens later behind a marketing decision.

### Schema additions

```ts
// apps/web/src/db/schema/jobs.ts
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id'),
    source: text('source').notNull(), // 'greenhouse'|'lever'|'workable'|'ashby'|'serper'|'jooble'|'adzuna'|'manual'
    company: text('company').notNull(),
    companySlug: text('company_slug'),
    title: text('title').notNull(),
    location: text('location'),
    description: text('description').notNull(),
    url: text('url').notNull(),
    urlNormalized: text('url_normalized').notNull(),
    remote: boolean('remote').default(false),
    seniority: text('seniority'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
    rawData: jsonb('raw_data'),
  },
  (t) => ({
    uniqSourceExternal: uniqueIndex('jobs_source_external_idx').on(t.source, t.externalId),
    urlNormIdx: index('jobs_url_norm_idx').on(t.urlNormalized),
  }),
);

export const userJobs = pgTable(
  'user_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    isFavorite: boolean('is_favorite').default(false),
    fitScore: integer('fit_score'), // 0-10
    fitRationale: text('fit_rationale'),
    fitStrengths: jsonb('fit_strengths').$type<string[]>(),
    fitGaps: jsonb('fit_gaps').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserJob: uniqueIndex('user_jobs_user_job_idx').on(t.userId, t.jobId),
  }),
);

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
  coverLetterId: uuid('cover_letter_id').references(() => coverLetters.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull(), // 'interested'|'applied'|'recruiter_screen'|'tech_interview'|'onsite'|'offer'|'rejected'|'ghosted'
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  notes: text('notes'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Services to port

- `packages/job-engine/src/sources/{greenhouse,lever,workable,ashby,serper,adzuna,jooble}.ts` — public API clients (no Playwright)
- `packages/job-engine/src/ingester.ts` — orchestrates all sources, dedupes by `urlNormalized`
- `packages/job-engine/src/importer.ts` — manual URL/paste via Claude haiku
- `packages/job-engine/src/fit-score.ts` — Claude haiku, Redis-cached by prompt hash
- `packages/job-engine/src/companies.json` — already Israel-focused, copy as-is

### UI routes

- `/[locale]/(app)/jobs` — inbox grid, search/filter bar
- `/[locale]/(app)/jobs/[id]` — detail + "Score Fit" + "Generate Resume" + "Track Application"
- `/[locale]/(app)/jobs/paste` — manual import form
- `/[locale]/(app)/applications` — kanban-style status board (Hebrew RTL means columns flow right-to-left)

### Cron

- `/api/cron/scrape-jobs` — runs daily at 06:00 Israel, hits all sources, ingests + dedupes
- `/api/cron/score-new-jobs` — runs after scrape, computes fit-score for new jobs vs each beta user's profile

### Beta gate

`users.featureFlags.jobHuntBeta: boolean` (jsonb default `{}`). Middleware
redirects `/jobs/*` to `/dashboard` with toast if flag false. Admin panel
gets a "Toggle beta access" button per user.

### Verification

- Vitest: ingester dedupe, importer extraction, fit-score parsing
- Manual: scrape returns >0 jobs for at least one source
- Manual: as beta-enabled user, paste URL → see job detail → fit-score → track application

---

## L6 — HR role + admin completeness

### HR role surface

- HR user dashboard = "My posted jobs" + "Applicants per job"
- `/[locale]/(app)/hr/jobs/new` — post a job (company auto-filled from HR's domain), saved with `source='hr'` + `hrUserId`
- `/[locale]/(app)/hr/jobs/[id]/edit` — edit own posts only (authorize on `hrUserId === session.user.id`)
- `/[locale]/(app)/hr/applicants` — list users who tracked an application to HR's jobs (consent: applicant explicitly opted in via "Notify recruiter" checkbox in tracker)
- HR users can NOT browse other HR jobs or scraped jobs in their UI — clean separation
- HR users CAN use resume builder + cover letter like normal users

### Data sharing consent (GDPR)

When a regular user tracks an application to an HR-posted job, they see
a checkbox: "Allow the recruiter to see I applied (name + email only)."
Default unchecked. If checked, HR sees the applicant in their list.
If unchecked, HR sees only an anonymized count. The choice is stored on
the `applications` row and reflected in the privacy policy.

### Admin polish

| #   | Add                                       | Where                                                                                                                                                     |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Row→detail link on users table            | `admin-user-search.tsx`                                                                                                                                   |
| 2   | Confirmation dialog on role + tier change | `admin-role-select.tsx`, `admin-tier-select.tsx`                                                                                                          |
| 3   | Users pagination (cursor-based)           | `/api/admin/users?cursor=X&limit=50`                                                                                                                      |
| 4   | Impersonate user (signed audit)           | New `/api/admin/impersonate/[id]/route.ts` — signs new session for target user, writes `admin_impersonate` audit, banner in UI shows "Acting as X — exit" |
| 5   | Resend verification email                 | Button on user detail page → fires Better Auth resend                                                                                                     |
| 6   | View resume/letter content                | New `/admin/users/[id]/resumes/[rid]` read-only viewer                                                                                                    |
| 7   | Audit log search/filter                   | `/admin/audit` page with date range + event-type filter                                                                                                   |
| 8   | Per-user cost in dollars                  | User detail page: `(tokens / 1_000_000) * $7`                                                                                                             |
| 9   | Cancel subscription with upstream sync    | New `/api/admin/users/[id]/subscription/cancel` — calls provider API to cancel, then updates local row                                                    |
| 10  | Subscription visibility                   | User detail shows: provider, tier, status, current_period_end, granted_by (manual/lemonsqueezy/stripe)                                                    |

### Verification

- HR user posts a job → appears in their list → can edit own → cannot edit other HR's
- Admin impersonate → see "Acting as X" banner → can exit cleanly
- Admin cancels paid sub → LS dashboard reflects cancellation within 1min

---

## L7 — QA sweep + Vercel preview live + deploy-ready

### Sweep checklist

- `pnpm -r typecheck` — must be clean
- `pnpm -r test` — must be clean, target 250+ passing
- `pnpm -r lint` — warnings OK, no errors
- `pnpm -C apps/web run build` — production build succeeds
- Playwright smoke for each persona (visitor, free, paying, HR, admin) — visit landing → core flow → done

### Vercel preview

- Follow `docs/runbooks/vercel-preview-deploy.md`
- Neon Postgres, no Redis (fail-closed acceptable for solo tester)
- All env vars set
- Live URL committed to PRE_LAUNCH.md for user to click

### Final state

- Commit all batches
- Push to main
- Tag `v0.1.0-pre-launch`
- Update PRE_LAUNCH.md status table

---

## Risk register

| Risk                                            | Mitigation                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| L5 schema migration takes down prod             | Use Drizzle's `--breakpoints`; rollback plan documented               |
| Theme refresh breaks shadcn dark mode           | Snapshot tests on key components before swap                          |
| Better Auth session hooks have side effects     | Write unit tests on `requireFreshSession` + suspended-role hook first |
| Job-hunt scrapers get IP-blocked                | Daily cron only (low frequency); skip Serper if no API key            |
| HR feature legal complexity (GDPR data sharing) | Explicit opt-in checkbox from applicant; document in privacy policy   |

---

## Done criteria

1. All 7 batches landed and committed
2. Full test suite passes (`pnpm -r test`)
3. Full typecheck passes
4. Vercel preview URL live and accessible
5. Manual click-through each persona completes their primary flow without errors
6. PRE_LAUNCH.md updated with final status
