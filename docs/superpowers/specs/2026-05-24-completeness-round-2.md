# Resumaker Completeness Round 2 — M-series Design

> Follow-up to `2026-05-24-completeness-design.md`. After L1-L7 shipped,
> user audit found many gaps a "complete SaaS" needs: full account
> settings, real PWA, compliance, blog, multi-locale, more personas.
> User approved all 10 batches in one session, full versions.

## New personas to support

- **Active job seeker** — daily applier, needs reminders + calendar + interview prep
- **Career changer** — wants skills-gap, alternate-path suggestions
- **Senior executive** — different tone/length, exec summary
- **Student / recent grad** — entry-level guidance, education-forward
- **Freelancer / consultant** — project portfolio, public profile
- **New immigrant (Olim)** — Hebrew + English on one resume
- **Multilingual** — Arabic + Russian
- **Career coach** — manages multiple clients
- **Recruitment agency** — team of HRs per company
- **Support staff** — `support` role gets useful permissions
- **API consumer** — programmatic resume generation via API keys
- **Mobile user** — PWA, push notifications
- **Visually impaired** — WCAG 2.1 AA throughout
- **Owner/operator (you)** — analytics dashboards

## Execution order (priority-weighted)

1. **M1** — Account & Settings completeness _(foundational)_
2. **M7** — Compliance & Accessibility _(legal, can't launch without)_
3. **M9** — Onboarding & Help _(new users need it day 1)_
4. **M2** — Resume editor polish _(core product)_
5. **M6** — Admin Operations _(operator visibility for launch)_
6. **M3** — Cover letter polish
7. **M4** — Job hunt expansion (scrape cron, alerts, kanban, prep)
8. **M5** — HR Recruiter completeness (applicants, team, bulk)
9. **M8** — SEO + PWA + marketing surface
10. **M10** — Multi-locale (ar, ru) + career-coach role + multi-tenant HR

---

## M1 — Account & Settings

### Tables

- `mfa_credentials` (TOTP secrets, backup codes hashed)
- `email_change_requests` (pending verifications)
- `notification_preferences` (per-channel opt-in)
- `user_avatars` (S3 key or data URL fallback)
- Reuse existing `users.locale` for language, add `users.theme`, `users.timezone`

### Routes

- `POST /api/account/password` — change password (requires current)
- `POST /api/account/mfa/totp/enroll` — generate secret, QR
- `POST /api/account/mfa/totp/verify` — confirm + activate
- `POST /api/account/mfa/totp/disable` — requires password
- `POST /api/account/email-change/request` — sends verification to new email
- `GET /api/account/email-change/confirm?token=...` — completes swap
- `GET/PATCH /api/account/notification-preferences` — granular opt-in
- `GET /api/account/sessions` — list active
- `DELETE /api/account/sessions/[id]` — revoke specific
- `POST /api/account/avatar` — upload (S3 or base64 jsonb)
- `PATCH /api/account/preferences` — theme, timezone, dateFormat

### Pages

- `/[locale]/(app)/settings` — refactored with tabs: Profile, Security,
  Notifications, Sessions, Appearance, Data, Danger Zone
- Settings sub-routes for each tab

### Verification

- typecheck clean, tests cover password-change validation +
  MFA secret generation, manual smoke each tab.

---

## M2 — Resume Editor Polish

### Tables

- `resume_share_links` (id, resumeId, slug, expiresAt, viewCount, isPasswordProtected, passwordHash)
- Extend `resumes.content` JSON to support custom sections

### Routes

- `POST /api/resumes/[id]/export?format=docx|txt|json` — additional export formats
- `POST /api/resumes/[id]/share` — create public link
- `DELETE /api/resumes/[id]/share/[shareId]` — revoke
- `GET /share/[slug]` — public viewer (no auth, RL'd)

### Components

- `ResumeInlineEditor` — click any field to edit
- `SectionReorderer` — drag-and-drop
- `CustomSectionAdder`
- `PhotoUploader`
- `PublicShareDialog`
- `ResumeComparisonView`

---

## M3 — Cover Letter Polish

### Tables

- `cover_letter_templates` (userId, name, body, tone)
- `cover_letters.content` becomes editable post-generation

### Routes

- `PATCH /api/cover-letters/[id]` — edit text after generation
- `GET/POST /api/cover-letter-templates` — personal library
- `POST /api/cover-letters/bulk-generate` — Pro feature, multiple JDs

### Pages

- `/cover-letters/[id]/edit` — full editor
- `/cover-letters/templates` — manage personal templates

---

## M4 — Job Hunt Expansion

### Tables

- `saved_searches` (userId, query JSON, alertFrequency, lastNotifiedAt)
- `application_reminders` (applicationId, remindAt, sent)
- `interview_preps` (applicationId, content, generatedAt)

### Routes

- `POST /api/cron/scrape-jobs` — daily Greenhouse/Lever/Workable/Ashby
- `POST /api/cron/job-digest-emails` — daily, sends matching jobs
- `GET/POST/DELETE /api/saved-searches`
- `POST /api/applications/[id]/prep` — generate interview prep
- `GET /api/applications/[id]/calendar.ics` — download
- `POST /api/applications/[id]/follow-up` — generate email
- `POST /api/applications/[id]/thank-you` — generate post-interview note

### Pages

- `/jobs/saved-searches` — manage alerts
- `/applications` enhanced with kanban view toggle
- `/applications/[id]/prep` — interview prep view

---

## M5 — HR/Recruiter Completeness

### Tables

- `companies` (id, name, slug, logoUrl, description, websiteUrl, ownerHrUserId)
- `company_members` (companyId, userId, role: owner|recruiter|viewer)
- Modify `jobs.hrUserId` → also `jobs.companyId`
- `job_views` (jobId, viewerId|null for anonymous, viewedAt)

### Routes

- `PATCH /api/hr/jobs/[id]` — edit own
- `DELETE /api/hr/jobs/[id]`
- `POST /api/hr/jobs/[id]/pause` and `/resume`
- `POST /api/hr/jobs/bulk-import` — CSV upload
- `GET /api/hr/jobs/[id]/applicants` — consent-respecting
- `GET /api/hr/jobs/[id]/analytics` — views, applies
- `GET/POST/PATCH /api/hr/companies` — company profile
- `GET/POST /api/hr/companies/[id]/members` — team management

### Pages

- `/hr/jobs/[id]/edit`
- `/hr/jobs/[id]/applicants`
- `/hr/jobs/[id]/analytics`
- `/hr/company` — profile editor
- `/hr/team` — invite/remove team members
- `/companies/[slug]` — public company page

---

## M6 — Admin Operations

### Routes

- `POST /api/admin/users/[id]/impersonate` — issues new session for target, audit
- `POST /api/admin/users/[id]/resend-verification`
- `POST /api/admin/users/[id]/force-password-reset`
- `POST /api/admin/users/[id]/subscription/cancel` — calls LS/Stripe API
- `POST /api/admin/users/[id]/subscription/refund` — partial/full
- `GET /api/admin/audit-log?from=&to=&event=&userId=` — searchable
- `POST /api/admin/broadcast` — email N users
- `GET /api/admin/analytics/dau` — daily active
- `GET /api/admin/analytics/funnel` — signup→first-resume→pay
- `GET /api/admin/analytics/cohort` — retention
- `GET /api/admin/analytics/mrr` — recurring revenue
- `POST /api/admin/maintenance/enable` and `/disable`
- `GET/POST /api/admin/coupons` — promo code CRUD

### Pages

- `/admin/audit` — search/filter
- `/admin/analytics` — DAU/MAU/MRR/cohort dashboards
- `/admin/broadcast` — compose + send
- `/admin/coupons` — manage
- `/admin/maintenance` — toggle

### Tables

- `coupons` (code, discount_percent, expires_at, usage_limit, usage_count)
- `coupon_redemptions` (couponId, userId, redeemedAt)
- `broadcast_emails` (id, subject, body, sentBy, sentAt, recipientCount)
- `maintenance_mode` (enabled bool, message, scheduledStart, scheduledEnd) — singleton

---

## M7 — Compliance & Accessibility

### Components

- `CookieBanner` — first-visit, granular (essential / analytics / marketing)
- `PrivacyPreferenceCenter` — manage from settings
- `TermsAcceptancePrompt` — fires when terms version bumps

### Tables

- `cookie_consents` (userId|cookieId, categories, acceptedAt, version)
- `terms_acceptances` (userId, version, acceptedAt)
- `data_processing_logs` (userId, request_type, fulfilledAt) — Art 15-22

### Routes

- `POST /api/account/gdpr/rectify` — Art 16, update email/name
- `POST /api/account/gdpr/restrict` — Art 18, pause processing
- `POST /api/account/gdpr/object` — Art 21, opt out of marketing
- `POST /api/account/gdpr/withdraw-consent` — Art 7(3)
- All existing routes get audit-logged when triggered for compliance

### Pages

- `/[locale]/legal/accessibility` — statement (WCAG 2.1 AA target)
- `/[locale]/legal/data-retention` — policy display
- `/[locale]/legal/dpa` — Data Processing Agreement
- `/settings/privacy` — preference center

### A11y work

- Audit every page with axe-core, fix all `serious` and `critical`
- Skip-to-content on every layout
- Focus indicators visible on all interactive elements
- ARIA labels comprehensive
- Reduced-motion preference respected
- Color contrast verified

---

## M8 — SEO + PWA + Marketing

### Files

- `apps/web/src/app/robots.ts` — dynamic robots.txt
- `apps/web/src/app/sitemap.ts` — dynamic sitemap including blog
- `apps/web/public/manifest.json` — PWA manifest (already exists, expand)
- `apps/web/src/sw.ts` — service worker via next-pwa or custom
- Per-page `generateMetadata` with OG + Twitter + Schema.org

### Routes

- `POST /api/push/subscribe` — store browser push subscription
- `POST /api/cron/push-notifications` — send queued

### Pages

- `/[locale]/blog` — MDX-driven, file-based posts
- `/[locale]/blog/[slug]` — individual post
- `/[locale]/tools/salary-estimator` — free standalone tool
- `/[locale]/tools/ats-scanner` — free standalone tool
- `/[locale]/testimonials` — display section
- `/[locale]/referral` — user-facing referral program

### Tables

- `push_subscriptions` (userId, endpoint, keys, createdAt)
- `referrals` (referrerId, referredId, status, rewardClaimedAt)
- `referral_codes` (code, ownerId, usageCount, maxUses)
- `testimonials` (name, role, quote, rating, locale, featured)

---

## M9 — Onboarding & Help

### Components

- `WelcomeTour` — Shepherd.js or custom overlay
- `SampleDataLoader` — one-click "import a sample profile"
- `NotificationBell` — header dropdown with unread count
- `HelpContactForm` — submits to support email + DB

### Tables

- `notifications` (userId, type, title, body, link, readAt, createdAt)
- `support_tickets` (userId|email, subject, body, status, createdAt, repliedAt)

### Routes

- `GET/PATCH /api/notifications` — list + mark read
- `POST /api/support/contact` — submit form
- `POST /api/cron/email-onboarding` — drip campaign

### Pages

- `/[locale]/faq` — accordion list
- `/[locale]/help` — knowledge base TOC
- `/[locale]/help/[slug]` — individual article (MDX)
- `/[locale]/contact` — form
- `/[locale]/status` — public status page (deps health)
- Welcome tour overlay on first dashboard visit

### Email sequences (Resend templates)

- Day 0: welcome (have)
- Day 1: "build your first resume" if none yet
- Day 3: "try the cover letter generator" if none yet
- Day 7: "you're 7 days in — here's what's new"
- Day 30: re-engagement if inactive

---

## M10 — Multi-locale + Multi-tenant

### Locales

- `ar` (Arabic, RTL) — full translation, RTL handling reuses Hebrew layer
- `ru` (Russian, LTR) — full translation, Cyrillic font support

### Files

- `apps/web/src/messages/ar.json`
- `apps/web/src/messages/ru.json`
- `apps/web/src/i18n/routing.ts` — add to locale union
- PDF templates: ensure Heebo + Inter cover the new scripts; add fallback font

### Career coach role

- New `users.role = 'coach'`
- `coach_clients` (coachId, clientUserId, addedAt)
- `/coach/clients` — list managed clients
- `/coach/clients/[id]` — view client's resumes (no edit unless granted)

### Multi-tenant HR (extends M5)

- Already lays the `companies` + `company_members` foundation
- Add invite tokens, role escalation flow

---

## Done criteria

1. All M1-M10 batches landed and committed
2. Full monorepo typecheck clean
3. Full test suite passing
4. PRE_LAUNCH.md updated
5. Pushed to main

## Risk register

| Risk                                        | Mitigation                                               |
| ------------------------------------------- | -------------------------------------------------------- |
| Context exhaustion mid-batch                | Commit after every batch; partial-commit if needed       |
| New schema breaks existing flows            | Migrations are additive only; existing routes untouched  |
| Multi-locale (M10) doubles translation work | Use AI translation as draft, mark for human review later |
| Service worker breaks dev                   | Disable in dev, ship behind a flag for prod              |
| 2FA lockout risk                            | Always provide backup codes + admin override             |
