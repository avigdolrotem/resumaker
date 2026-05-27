# syntax=docker/dockerfile:1.7

# Multi-stage build for Next.js app
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

# Install dependencies only when lockfile changes
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-safety/package.json ./packages/ai-safety/
COPY packages/ats-scorer/package.json ./packages/ats-scorer/
COPY packages/job-engine/package.json ./packages/job-engine/
COPY packages/resume-engine/package.json ./packages/resume-engine/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build the app
FROM base AS builder
# NEXT_PUBLIC_* env vars are inlined at build time into the client bundle —
# the Sentry DSN is public-by-design (rate-limited per project at Sentry's
# end) so passing it here is the canonical way to enable browser-side
# error capture. CI sets this via `docker build --build-arg`.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Build-only env stubs. Next 16 sets NODE_ENV=production during `next
# build`, which trips env.ts's production refines (APP_URL must not be
# localhost, GCP Cloud SQL must be set, etc.). Real values are injected
# at runtime via ExternalSecrets → pod env. These stubs only need to
# satisfy Zod parsing — the build doesn't actually connect anywhere
# (db/index.ts is wrapped in a try/catch that falls back to a stub
# client when the connect fails).
ENV APP_URL=https://build.example.com \
    NEXT_PUBLIC_APP_URL=https://build.example.com \
    BETTER_AUTH_URL=https://build.example.com \
    BETTER_AUTH_SECRET=build-stub-secret-thirty-two-chars-minimum-here \
    CRON_SECRET=build-stub-cron-secret-thirty-two-chars-min \
    IP_HASH_SALT=build-stub-ip-hash-salt-thirty-two-chars-minimum-padding \
    GCP_CLOUD_SQL_INSTANCE=build-stub:europe-west1:build-stub \
    GCP_CLOUD_SQL_IAM_USER=build-stub@build.iam.gserviceaccount.com

RUN pnpm --filter @resumaker/web build

# Runtime image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Migration runner (used by the Helm pre-install Job). The Next.js
# standalone output excludes devDeps like drizzle-kit, so we ship a
# tiny migrator using only runtime deps (drizzle-orm + postgres) which
# are already inside .next/standalone's node_modules tree. Copy the
# script + the migrations directory it reads.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle ./apps/web/drizzle

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
