# Local Development Setup

## Prerequisites

| Tool           | Min version | Install (macOS)                                              |
| -------------- | ----------- | ------------------------------------------------------------ |
| Node.js        | 22.x        | `brew install node`                                          |
| pnpm           | 9.x         | `npm install -g pnpm`                                        |
| Docker Desktop | 27+         | [docker.com](https://www.docker.com/products/docker-desktop) |
| AWS CLI        | 2.34+       | `brew install awscli`                                        |
| OpenTofu       | 1.12+       | `brew install opentofu`                                      |
| kubectl        | 1.34+       | `brew install kubectl`                                       |
| Helm           | 4.x         | `brew install helm`                                          |
| pre-commit     | 4.x         | `brew install pre-commit`                                    |
| gitleaks       | 8.x         | `brew install gitleaks`                                      |
| trivy          | 0.70+       | `brew install trivy`                                         |

All already installed if you went through the project setup.

## First-time Setup

```bash
# 1. Clone the repo
git clone git@github.com:rotem/resumaker.git
cd resumaker

# 2. Install dependencies
pnpm install

# 3. Install pre-commit hooks
pnpm prepare    # or: pre-commit install

# 4. Copy env template and fill in real values
cp .env.example .env
# Edit .env — values for local dev (see below)

# 5. Start local infrastructure (Postgres, Redis, Localstack)
docker-compose up -d

# 6. Run database migrations
pnpm --filter @resumaker/auth db:migrate

# 7. Start dev servers
pnpm dev   # Starts frontend on localhost:3000
```

## Environment Variables for Local Dev

Most values in `.env.example` work as-is. Critical ones to set:

### Required

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...   # From /Volumes/Server_Data/secrets/resumaker.env
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

### Optional (skip for basic dev)

```bash
GOOGLE_CLIENT_ID=...     # Only if testing Google OAuth
SENTRY_DSN=...           # Errors logged to console without this
STRIPE_SECRET_KEY=...    # Billing infrastructure works without
```

## Project Layout Walkthrough

```
resumaker/
├── apps/web                 # Next.js frontend
│   ├── app/
│   │   ├── [locale]/        # i18n routes (he, en)
│   │   ├── api/             # Server actions + auth routes
│   │   └── globals.css
│   ├── components/
│   ├── messages/            # i18n catalogs (he.json, en.json)
│   └── package.json
│
├── apps/api/                # Backend microservices
│   ├── auth/                # Better Auth service
│   ├── jd-parser/           # Job description parsing
│   ├── resume-generator/    # LLM orchestration
│   ├── ats-scorer/          # ATS keyword scoring
│   └── billing/             # Stripe integration
│
├── packages/                # Shared libraries
│   ├── shared/              # Types, Zod schemas
│   ├── ui/                  # React components
│   ├── ai-safety/           # LLM safety layer
│   ├── resume-engine/       # React-PDF templates
│   └── ats-scorer/          # Keyword extraction
│
├── infra/
│   ├── tofu/                # OpenTofu modules + envs
│   ├── ansible/             # Server config
│   └── helm/                # K8s charts
│
├── docs/                    # Architecture & design docs
├── scripts/                 # Build & deploy scripts
└── tests/                   # E2E, integration, security tests
```

## Common Tasks

### Run a single app

```bash
pnpm --filter @resumaker/web dev          # Frontend only
pnpm --filter @resumaker/auth dev         # Auth API only
```

### Run all backend services

```bash
pnpm dev:api    # Starts all services in apps/api/*
```

### Lint / Format / Typecheck

```bash
pnpm lint        # ESLint across workspace
pnpm format      # Prettier write
pnpm typecheck   # tsc --noEmit on every package
```

### Test

```bash
pnpm test                          # Unit tests (vitest)
pnpm test:e2e                      # Playwright E2E (slow)
pnpm --filter @resumaker/web test  # Specific package
```

### Security Scans (run before PR)

```bash
pnpm security:secrets   # gitleaks
pnpm security:deps      # pnpm audit + trivy
pnpm security:iac       # trivy on OpenTofu
pnpm security:all       # all of the above
```

### Database

```bash
# Generate migration after schema change
pnpm --filter @resumaker/auth db:generate

# Apply migrations
pnpm --filter @resumaker/auth db:migrate

# Open Drizzle Studio (DB browser)
pnpm --filter @resumaker/auth db:studio
```

### Infrastructure

```bash
# Format all .tf files
pnpm infra:fmt

# Validate without applying
pnpm infra:validate

# Plan dev environment
pnpm infra:plan:dev

# Actually apply (CAREFUL)
cd infra/tofu/environments/dev && tofu apply
```

## Docker Compose Services

```yaml
# docker-compose.yml provides:
- postgres:17       (port 5432)
- redis:7           (port 6379)
- localstack        (port 4566 — emulates S3, SQS, etc)
- mailhog           (port 8025 — captures dev emails)
```

## Troubleshooting

### "Port 3000 already in use"

Something else is running. Find + kill: `lsof -ti:3000 | xargs kill`

### "Database connection refused"

Postgres container not running. `docker-compose up -d postgres`

### "Module not found" after switching branches

`pnpm install` again — dependencies may have changed.

### Hebrew text shows reversed / weird

Check that the page has `dir="rtl"` on `<html>` for Hebrew. See `apps/web/app/[locale]/layout.tsx`.

### LLM calls timing out

Check `ANTHROPIC_API_KEY` is set. Test directly:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":50,"messages":[{"role":"user","content":"hello"}]}'
```

### Pre-commit hook fails

Run `pre-commit run --all-files` to see what's failing. Fix the underlying issue, don't `--no-verify`.

## VS Code Setup

Recommended extensions auto-installed via `.vscode/extensions.json`:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- HashiCorp Terraform
- YAML
- Docker

Recommended settings (in `.vscode/settings.recommended.json`):

- Format on save (Prettier)
- ESLint auto-fix
- Tailwind class detection in `cn()` and `cva()`

Copy `.vscode/settings.recommended.json` to `.vscode/settings.json` to opt in.

## Helpful Aliases

Add to `~/.zshrc`:

```bash
alias rm-dev='pnpm dev'
alias rm-test='pnpm test'
alias rm-lint='pnpm lint && pnpm typecheck'
alias rm-up='cd /Volumes/Server_Data/code-server/workspace/resumaker && docker-compose up -d'
alias rm-down='cd /Volumes/Server_Data/code-server/workspace/resumaker && docker-compose down'
```

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — System overview
- [STACK.md](STACK.md) — Tech choices
- [DEVOPS.md](DEVOPS.md) — Deployment process
