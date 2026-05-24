# Vercel preview deploy (one-off, to see the app live before AWS)

The point of this runbook: get a public URL like `resumaker-xxx.vercel.app`
so you can click around the actual UI before committing the AWS infra spend
and the days of EKS bootstrapping. **5–10 minutes from start to a live URL.**

This is a **temporary** preview environment. The prod target is still AWS EKS
— Vercel is just a fast way to validate the UX. When AWS is live you can
delete the Vercel project with zero impact.

## What this won't have

- LemonSqueezy webhook will 503 (Vercel preview URL not registered in LS)
- ElastiCache Redis isn't reachable from Vercel → rate limiter fails closed
- No Sentry source-map upload (Vercel passes `NEXT_PUBLIC_SENTRY_DSN` at
  build time and that's enough for browser errors, but server-side Sentry
  needs `SENTRY_DSN` at runtime — set if you want it)

What it WILL have: full Hebrew UI, builder, dashboard, pricing page, all
templates, ATS scoring, cover letters, sign-up + sign-in (with email
verification if RESEND_API_KEY is set).

## Prerequisites

- Vercel account (free) — sign up at vercel.com
- `vercel` CLI: `npm i -g vercel`
- The repo pushed to GitHub (already done)
- A free Postgres somewhere — easiest is **Neon** (neon.tech) or
  **Supabase** (supabase.com). Both have generous free tiers. Skip Redis
  entirely (preview accepts that auth endpoints will fail-closed under
  load — fine for a tester clicking around).

## Steps

### 1. Get a Postgres connection string

**Option A — Neon (recommended):**

1. Sign up at neon.tech, create a project named `resumaker-preview`
2. Region: any (latency doesn't matter for previewing)
3. Copy the connection string (looks like `postgres://user:pass@ep-...neon.tech/neondb?sslmode=require`)

**Option B — Supabase:** Settings → Database → Connection string → Connection pooling (use the "transaction" mode URL).

### 2. Apply migrations to the new DB

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker/apps/web
DATABASE_URL="<paste connection string>" pnpm exec drizzle-kit migrate
```

Expect: "5 migrations applied" or similar.

### 3. Link the repo to Vercel

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
vercel login            # browser flow
vercel link             # follow prompts:
                        #   - Set up project? yes
                        #   - Scope: your personal account
                        #   - Link to existing project? no
                        #   - Project name: resumaker-preview
                        #   - Code directory: ./apps/web
                        #   - (auto-detects Next.js)
```

### 4. Set the minimum env vars on Vercel

```bash
# Server-side runtime env (Vercel UI also works)
vercel env add DATABASE_URL production           # paste Neon URL
vercel env add ANTHROPIC_API_KEY production      # paste from /Volumes/Server_Data/secrets/anthropic_api_key
vercel env add BETTER_AUTH_SECRET production     # paste from notepad
vercel env add BETTER_AUTH_URL production        # https://resumaker-preview.vercel.app (or whatever Vercel assigns)
vercel env add APP_URL production                # same URL
vercel env add IP_HASH_SALT production           # paste from notepad
vercel env add CRON_SECRET production            # paste from notepad
vercel env add PAYMENT_PROVIDER production       # set to: none

# Optional but recommended
vercel env add SENTRY_DSN production             # paste from notepad
vercel env add RESEND_API_KEY production         # for email verification to actually deliver

# Skip Redis — fail-closed rate limit is fine for a single tester
vercel env add REDIS_URL production              # leave blank or skip
```

### 5. Deploy

```bash
vercel --prod
```

First deploy takes 3-5 min (cold install + build). Subsequent deploys ~1 min.

Output ends with a URL like `https://resumaker-preview.vercel.app`.

### 6. Click around

- Visit the URL → expect the Hebrew marketing homepage
- `/pricing` → 3 tiers + interval toggle, "coming soon" CTA (because PAYMENT_PROVIDER=none)
- `/sign-up` → register a test account
- `/he/builder` → paste any job description, generate a resume
- `/he/dashboard` → see the onboarding checklist
- Switch language via the navbar locale switcher (he ↔ en)

### 7. When you're done previewing

Either keep the preview around (free tier handles ~100 visits/day) or
delete it:

```bash
vercel project rm resumaker-preview
```

No impact on the AWS prod plan. The repo + GitHub Actions + tofu state
aren't touched by anything on Vercel.

## Troubleshooting

- **Build fails on `@react-pdf/renderer`** — Vercel sometimes needs
  `installCommand: "pnpm install --no-frozen-lockfile"` set in
  `vercel.json` or project settings. Try that if the build errors out
  with a peer-dep complaint.

- **"DATABASE_URL is required" at runtime** — env var not set in the
  correct environment (production vs preview). Use `vercel env ls` to
  audit, re-add with the right environment scope.

- **Better Auth redirects loop on Vercel URL** — `BETTER_AUTH_URL` must
  match the exact Vercel URL with `https://` prefix and no trailing
  slash. The locale prefix (`/he`) is not part of this URL.

- **Want to swap to a fresh Postgres** — change the Neon project and
  re-run `pnpm exec drizzle-kit migrate` against the new URL. Then
  update the Vercel env var and trigger a new deploy.
