# Microservices

## Philosophy

Start with logical separation in a monorepo. Optimize physical boundaries when they hurt.

We separate by business capability, not technical layer. Each service:
- Owns its data (no shared tables across services)
- Has clear API contracts (OpenAPI spec checked into repo)
- Can be deployed independently (separate container, separate Helm chart)
- Has its own metrics, logs, and SLOs

For V1, all services start in one EKS cluster with shared Postgres. Splitting databases comes after we see real load patterns.

## Service Catalog

### 1. Frontend (`apps/web`)
Not technically a microservice — it's the Next.js app. Listed for completeness.

**Tech**: Next.js 16, hosted on Vercel
**Endpoints**: All `/` paths
**Dependencies**: Auth Service (via cookies), API Gateway

### 2. Auth Service (`apps/api/auth`)
**Tech**: Hono + Better Auth, Postgres
**Port**: 3001
**Responsibilities**:
- User registration, login, OAuth, magic links
- Session management
- Password reset
- 2FA / passkeys
- Account deletion (cascading)

**API**:
| Method | Path | Description |
|---|---|---|
| POST | `/auth/sign-up` | Create user |
| POST | `/auth/sign-in` | Email login |
| POST | `/auth/sign-out` | End session |
| GET | `/auth/session` | Current session info |
| ... | (see [AUTH.md](AUTH.md)) | |

**Data ownership**: `users`, `accounts`, `sessions`, `verification_tokens`, `two_factor`, `passkeys`

### 3. JD Parser (`apps/api/jd-parser`)
**Tech**: Hono, Playwright (headless), Firecrawl (optional)
**Port**: 3002
**Responsibilities**:
- Accept text paste
- Accept URL → fetch via Playwright/Firecrawl
- Strip noise (ads, nav)
- Detect language
- Cache parsed JDs in Redis (24h TTL)

**API**:
| Method | Path | Description |
|---|---|---|
| POST | `/parse/text` | Sanitize pasted JD text |
| POST | `/parse/url` | Fetch + sanitize from URL |
| GET | `/parse/health` | Health check |

**Data ownership**: `parsed_jds` (cached), parses persisted briefly

### 4. Resume Generator (`apps/api/resume-generator`)
**Tech**: Hono, Vercel AI SDK, Postgres
**Port**: 3003
**Responsibilities**:
- Build LLM prompts (system + user separation)
- Route to LLM via orchestrator
- Apply AI Safety Layer (input + output)
- Persist generation history
- Return structured resume JSON

**API**:
| Method | Path | Description |
|---|---|---|
| POST | `/generate` | Generate resume from JD + profile |
| GET | `/generations` | List user's generations |
| GET | `/generations/:id` | Get specific generation |

**Data ownership**: `resumes`, `generations`

### 5. ATS Scorer (`apps/api/ats-scorer`)
**Tech**: Hono, custom keyword extraction + Claude verification
**Port**: 3004
**Responsibilities**:
- Extract keywords from JD
- Match against resume content
- Compute score (0-100)
- Suggest improvements (missing keywords)

**API**:
| Method | Path | Description |
|---|---|---|
| POST | `/score` | Score resume against JD |
| GET | `/score/:id` | Get cached score |

**Data ownership**: `ats_scores` (cached results)

### 6. Billing (`apps/api/billing`)
**Tech**: Hono, Stripe SDK
**Port**: 3005
**Responsibilities**:
- Subscription lifecycle (infrastructure only at launch)
- Stripe webhook handling
- Usage metering
- Entitlement checks (does user have access to X?)

**API**:
| Method | Path | Description |
|---|---|---|
| POST | `/checkout/create` | Create Stripe checkout session |
| POST | `/portal/create` | Customer portal session |
| POST | `/webhook/stripe` | Stripe events |
| GET | `/entitlements` | What can current user do? |

**Data ownership**: `subscriptions`, `payment_methods`, `usage_events`

## Communication Patterns

### Synchronous (HTTP/JSON)
Default for user-facing flows where you need an immediate answer.

```
Frontend → API Gateway → Auth (verify session)
                      → JD Parser (sanitize input)
                      → Resume Generator (generate)
                      → ATS Scorer (score)
                      → respond to Frontend
```

### Async / Event-Driven (Future)
When we add long-running tasks (e.g., batch resume generation, bulk job search):
- **AWS SQS** for queues
- **EventBridge** for fan-out events
- **DynamoDB Streams** if we add DynamoDB later

For V1: all synchronous. Add async only when needed.

### Service-to-Service Auth
Internal calls authenticated via:
- **mTLS** in EKS (Linkerd service mesh, optional in V1)
- **HMAC signatures** on each request (mandatory)
- Service tokens issued at startup, rotated daily

## Shared Packages

### `packages/shared`
Types, Zod schemas, error classes used across services.

### `packages/ai-safety`
LLM safety layer (input filter, output validator, rate limiter, orchestrator).
Used by: Resume Generator, ATS Scorer (if it ever calls LLM).

### `packages/ui`
React components used by frontend (button, input, layout, etc.). Re-exports from shadcn/ui with our customizations.

### `packages/resume-engine`
Resume rendering logic (React-PDF templates). Used by frontend.

### `packages/ats-scorer`
Keyword extraction logic. Used by `apps/api/ats-scorer`.

## Database Strategy

### V1: Shared Postgres
One database, schema-per-domain for clarity.

```
postgres://resumaker
├── public.users           (Auth)
├── public.accounts        (Auth)
├── public.sessions        (Auth)
├── public.resumes         (Generator)
├── public.generations     (Generator)
├── public.ats_scores      (Scorer)
├── public.subscriptions   (Billing)
└── public.audit_log       (cross-cutting)
```

### V2 (if needed): Per-service databases
Each service gets own Postgres DB. Migrate via:
1. Add new DB
2. Dual-write from service
3. Backfill via batch job
4. Stop writing to old
5. Drop old tables

We don't pre-optimize. We do this only if load demands it.

## Service Discovery

### Local Dev
Docker Compose with explicit hostnames.

### EKS Production
Kubernetes-native service discovery:
- `auth-service.resumaker.svc.cluster.local`
- `resume-generator.resumaker.svc.cluster.local`
- etc.

API Gateway routes external traffic to services by path prefix.

## Failure Modes

| Failure | Detection | Mitigation |
|---|---|---|
| Service unreachable | HTTP 503/timeout | Circuit breaker, retry with backoff, fail fast |
| Service slow | P95 latency alert | Auto-scale (HPA), investigate |
| Database connection exhaustion | Connection refused | Connection pooling (pgBouncer), increase limits |
| Cache miss spike | Redis miss rate alert | Stampede protection (single-flight) |
| LLM timeout | 60s timeout | Retry once with smaller prompt, then fail |
| LLM cost spike | Anthropic billing alert | Circuit breaker, disable free tier temporarily |

## Observability per Service

Each service exposes:
- `/health` — liveness probe
- `/ready` — readiness probe
- `/metrics` — Prometheus metrics
- OpenTelemetry spans for all incoming/outgoing HTTP

Standard metrics:
- `http_requests_total` (by method, path, status)
- `http_request_duration_seconds` (histogram)
- `business_operation_total` (e.g., `resumes_generated_total`)
- `business_operation_failed` with `reason` label

## Service Independence Test

Before declaring V1 done:
- Stop the Billing service → Resume Generator still works (degraded: can't check entitlements, but defaults to free tier)
- Stop the ATS Scorer → Resume Generator returns resume without score (UI shows "scoring unavailable")
- Stop the JD Parser → Frontend shows error, but Auth/Profile pages still work

No service is a single point of failure for unrelated flows.

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — Overall system
- [DEVOPS.md](DEVOPS.md) — How services get deployed
- [AI_SAFETY.md](AI_SAFETY.md) — Safety layer detail
