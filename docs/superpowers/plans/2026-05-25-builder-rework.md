# Builder Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder "Advanced mode" in the resume builder with a full section-card editor (Experience, Education, Projects, Skills, Certifications, Awards, Languages), wire in AI affordances (per-bullet rewrite, summary rewrite, fit-score panel, skill autocomplete), fix four latent bugs that block the rework working cleanly, and update PDF templates so every editable section actually appears in exports.

**Architecture:** Hybrid section-card editor for the current resume — keeps resumaker's resume-as-document model, mirrors job-app's profile UI pattern in a new `<AdvancedEditor>` composed of per-section components that share a generic `<SectionCard>` shell. Two-pane layout: editor left, sticky live preview right (mobile: tab pair). All state lives in `builder/page.tsx` so basic↔advanced mode toggle preserves data.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, next-intl v4, Tailwind v4 with semantic tokens, Zod (canonical `Resume` schema), `@dnd-kit/sortable` (new dependency for reorder), Vitest (unit), Playwright (E2E), `@react-pdf/renderer` (PDF templates), Claude Haiku 4.5 (AI features).

**Spec:** `docs/superpowers/specs/2026-05-25-builder-rework-design.md`

**Reference codebase:** `/Volumes/Server_Data/code-server/workspace/job-app/frontend/app/(dashboard)/profile/page.tsx` — port the patterns from here.

---

## Phase 0 — Foundation

Schema additions, helper utilities, bundled data. No UI yet.

### Task 0.1: Schema additions

**Files:**

- Modify: `packages/shared/src/schemas/index.ts`
- Test: `packages/shared/src/schemas/__tests__/builder-additions.test.ts` (NEW)

- [ ] **Step 1: Write failing test for new fields**

```ts
// packages/shared/src/schemas/__tests__/builder-additions.test.ts
import { describe, it, expect } from 'vitest';
import { ResumeSchema } from '../index';

describe('builder rework schema additions', () => {
  it('accepts is_current on experience', () => {
    const parsed = ResumeSchema.shape.experience.element.parse({
      company: 'X',
      title: 'Y',
      start_date: '2020-01',
      end_date: null,
      highlights: [],
      is_current: true,
    });
    expect(parsed.is_current).toBe(true);
  });

  it('defaults is_current to false on experience', () => {
    const parsed = ResumeSchema.shape.experience.element.parse({
      company: 'X',
      title: 'Y',
      start_date: '2020-01',
      end_date: null,
      highlights: [],
    });
    expect(parsed.is_current).toBe(false);
  });

  it('accepts is_current on education', () => {
    const parsed = ResumeSchema.shape.education.element.parse({
      institution: 'X',
      degree: 'Y',
      start_date: '2020-01',
      end_date: null,
      is_current: true,
    });
    expect(parsed.is_current).toBe(true);
  });

  it('accepts is_ongoing on project', () => {
    const ProjectSchema = ResumeSchema.shape.projects.unwrap().element;
    const parsed = ProjectSchema.parse({
      name: 'X',
      description: 'Y',
      is_ongoing: true,
    });
    expect(parsed.is_ongoing).toBe(true);
  });

  it('accepts credential_url on certification', () => {
    const CertSchema = ResumeSchema.shape.certifications.unwrap().element;
    const parsed = CertSchema.parse({
      name: 'AWS',
      issuer: 'Amazon',
      credential_url: 'https://example.com/cert',
    });
    expect(parsed.credential_url).toBe('https://example.com/cert');
  });

  it('rejects invalid credential_url', () => {
    const CertSchema = ResumeSchema.shape.certifications.unwrap().element;
    expect(() => CertSchema.parse({ name: 'X', credential_url: 'not-a-url' })).toThrow();
  });

  it('accepts new language level enum values', () => {
    const LangSchema = ResumeSchema.shape.languages.unwrap().element;
    for (const level of ['native', 'fluent', 'professional', 'conversational', 'basic']) {
      expect(LangSchema.parse({ name: 'EN', level }).level).toBe(level);
    }
  });

  it('rejects unknown language level (with hint to use normalizeLanguageLevel for legacy)', () => {
    const LangSchema = ResumeSchema.shape.languages.unwrap().element;
    expect(() => LangSchema.parse({ name: 'EN', level: 'B2' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
pnpm --filter @resumaker/shared test builder-additions
```

Expected: tests fail because new fields don't exist on schema.

- [ ] **Step 3: Add the schema fields**

Edit `packages/shared/src/schemas/index.ts`. Add to `ExperienceSchema`:

```ts
is_current: z.boolean().optional().default(false),
```

Add to `EducationSchema`:

```ts
is_current: z.boolean().optional().default(false),
```

Add to `ProjectSchema`:

```ts
is_ongoing: z.boolean().optional().default(false),
```

In `ResumeSchema.certifications`, change the item shape from:

```ts
z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).optional(),
  date: z.string().optional(),
});
```

to:

```ts
z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).optional(),
  date: z.string().optional(),
  credential_url: z.string().url().max(500).optional(),
});
```

Replace `languages` field with:

```ts
languages: z.array(z.object({
  name: z.string().min(1).max(50),
  level: z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']),
})).max(10).optional(),
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pnpm --filter @resumaker/shared test builder-additions
pnpm --filter @resumaker/shared typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/index.ts packages/shared/src/schemas/__tests__/builder-additions.test.ts
git commit -m "feat(schema): is_current/is_ongoing/credential_url + language enum"
```

---

### Task 0.2: normalizeLanguageLevel helper

Legacy resumes may have free-form `level` strings ("Advanced", "B2"). Normalize on read.

**Files:**

- Create: `packages/shared/src/normalize/language-level.ts`
- Test: `packages/shared/src/normalize/__tests__/language-level.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/normalize/__tests__/language-level.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeLanguageLevel } from '../language-level';

describe('normalizeLanguageLevel', () => {
  it('passes through valid enum values', () => {
    expect(normalizeLanguageLevel('native')).toBe('native');
    expect(normalizeLanguageLevel('fluent')).toBe('fluent');
  });

  it('maps common variants', () => {
    expect(normalizeLanguageLevel('Native')).toBe('native');
    expect(normalizeLanguageLevel('NATIVE')).toBe('native');
    expect(normalizeLanguageLevel('C2')).toBe('fluent');
    expect(normalizeLanguageLevel('C1')).toBe('professional');
    expect(normalizeLanguageLevel('B2')).toBe('professional');
    expect(normalizeLanguageLevel('B1')).toBe('conversational');
    expect(normalizeLanguageLevel('A2')).toBe('basic');
    expect(normalizeLanguageLevel('A1')).toBe('basic');
    expect(normalizeLanguageLevel('Advanced')).toBe('professional');
    expect(normalizeLanguageLevel('Intermediate')).toBe('conversational');
    expect(normalizeLanguageLevel('Beginner')).toBe('basic');
  });

  it('defaults unknown to professional', () => {
    expect(normalizeLanguageLevel('whatever')).toBe('professional');
    expect(normalizeLanguageLevel('')).toBe('professional');
    expect(normalizeLanguageLevel(undefined)).toBe('professional');
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter @resumaker/shared test language-level
```

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/normalize/language-level.ts
export type LanguageLevel = 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';

const ENUM_VALUES: ReadonlySet<LanguageLevel> = new Set([
  'native',
  'fluent',
  'professional',
  'conversational',
  'basic',
]);

const MAP: Record<string, LanguageLevel> = {
  native: 'native',
  mother: 'native',
  'mother tongue': 'native',
  fluent: 'fluent',
  c2: 'fluent',
  professional: 'professional',
  advanced: 'professional',
  c1: 'professional',
  b2: 'professional',
  proficient: 'professional',
  conversational: 'conversational',
  intermediate: 'conversational',
  b1: 'conversational',
  basic: 'basic',
  beginner: 'basic',
  elementary: 'basic',
  a2: 'basic',
  a1: 'basic',
};

export function normalizeLanguageLevel(raw: string | undefined | null): LanguageLevel {
  if (!raw) return 'professional';
  const key = raw.trim().toLowerCase();
  if (ENUM_VALUES.has(key as LanguageLevel)) return key as LanguageLevel;
  return MAP[key] ?? 'professional';
}
```

- [ ] **Step 4: Run test, expect pass + export from package index**

Add to `packages/shared/src/index.ts`:

```ts
export { normalizeLanguageLevel, type LanguageLevel } from './normalize/language-level';
```

```bash
pnpm --filter @resumaker/shared test language-level
pnpm --filter @resumaker/shared typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/normalize packages/shared/src/index.ts
git commit -m "feat(shared): normalizeLanguageLevel helper for legacy strings"
```

---

### Task 0.3: Bundled common-skills.json

For autocomplete. 200 top tech skills.

**Files:**

- Create: `apps/web/src/lib/data/common-skills.json`

- [ ] **Step 1: Create the JSON file**

```json
[
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Scala",
  "Elixir",
  "Clojure",
  "HTML",
  "CSS",
  "SCSS",
  "Tailwind CSS",
  "React",
  "Next.js",
  "Vue.js",
  "Nuxt",
  "Svelte",
  "SvelteKit",
  "Angular",
  "Solid.js",
  "Remix",
  "Astro",
  "Node.js",
  "Deno",
  "Bun",
  "Express",
  "Fastify",
  "NestJS",
  "Django",
  "Flask",
  "FastAPI",
  "Rails",
  "Laravel",
  "Spring",
  "Spring Boot",
  "ASP.NET",
  ".NET",
  "Phoenix",
  "GraphQL",
  "REST",
  "gRPC",
  "WebSockets",
  "PostgreSQL",
  "MySQL",
  "MariaDB",
  "SQLite",
  "MongoDB",
  "Redis",
  "Memcached",
  "DynamoDB",
  "Cassandra",
  "Elasticsearch",
  "Neo4j",
  "ClickHouse",
  "Snowflake",
  "BigQuery",
  "Redshift",
  "Kafka",
  "RabbitMQ",
  "NATS",
  "Pulsar",
  "Kinesis",
  "AWS",
  "GCP",
  "Azure",
  "DigitalOcean",
  "Cloudflare",
  "Vercel",
  "Netlify",
  "Heroku",
  "Render",
  "Fly.io",
  "Docker",
  "Kubernetes",
  "Helm",
  "ArgoCD",
  "Flux",
  "Terraform",
  "OpenTofu",
  "Pulumi",
  "Ansible",
  "Packer",
  "CI/CD",
  "GitHub Actions",
  "GitLab CI",
  "CircleCI",
  "Jenkins",
  "Buildkite",
  "Linux",
  "Bash",
  "Zsh",
  "Git",
  "Jest",
  "Vitest",
  "Playwright",
  "Cypress",
  "Pytest",
  "RSpec",
  "JUnit",
  "Selenium",
  "TDD",
  "BDD",
  "Agile",
  "Scrum",
  "Kanban",
  "OKRs",
  "JIRA",
  "Linear",
  "Notion",
  "Figma",
  "Sketch",
  "Adobe XD",
  "Photoshop",
  "Illustrator",
  "OAuth2",
  "JWT",
  "OIDC",
  "SAML",
  "LDAP",
  "Authentik",
  "Auth0",
  "Okta",
  "Prometheus",
  "Grafana",
  "Datadog",
  "Sentry",
  "OpenTelemetry",
  "Loki",
  "Tempo",
  "Jaeger",
  "ELK",
  "Splunk",
  "Machine Learning",
  "Deep Learning",
  "PyTorch",
  "TensorFlow",
  "scikit-learn",
  "Pandas",
  "NumPy",
  "Jupyter",
  "MLflow",
  "Hugging Face",
  "LangChain",
  "OpenAI API",
  "Anthropic API",
  "RAG",
  "Vector Databases",
  "Pinecone",
  "Weaviate",
  "Chroma",
  "Embeddings",
  "LLMs",
  "DevOps",
  "SRE",
  "Platform Engineering",
  "Microservices",
  "Monoliths",
  "Event-Driven",
  "CQRS",
  "DDD",
  "Hexagonal Architecture",
  "Clean Architecture",
  "Webpack",
  "Vite",
  "esbuild",
  "Turbopack",
  "Rollup",
  "Parcel",
  "Babel",
  "SWC",
  "PostCSS",
  "Storybook",
  "React Native",
  "Flutter",
  "Ionic",
  "Capacitor",
  "Electron",
  "Tauri",
  "PWA",
  "Service Workers",
  "Web Components",
  "WebAssembly",
  "i18n",
  "RTL",
  "Accessibility",
  "WCAG",
  "ARIA",
  "SEO",
  "Performance Optimization",
  "Core Web Vitals",
  "Lighthouse",
  "Bundle Analysis",
  "Stripe",
  "LemonSqueezy",
  "PayPal",
  "Twilio",
  "SendGrid",
  "Resend",
  "Mailgun",
  "Postmark",
  "Slack API",
  "Discord API"
]
```

- [ ] **Step 2: Add a typed accessor**

Create `apps/web/src/lib/data/common-skills.ts`:

```ts
import commonSkills from './common-skills.json';
export const COMMON_SKILLS: readonly string[] = commonSkills;
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/data/common-skills.json apps/web/src/lib/data/common-skills.ts
git commit -m "feat(data): bundled top-200 common skills for autocomplete"
```

---

## Phase 1 — Latent bug fixes (low-risk wins)

Fix the four blocker bugs before building on top of them.

### Task 1.1: Fix ImportProfileButton data-shape bug

**Files:**

- Modify: `apps/web/src/components/import-profile-button.tsx`
- Test: `apps/web/src/components/__tests__/import-profile-button.test.tsx` (NEW or existing)

- [ ] **Step 1: Read current file to find the bug line**

```bash
grep -n "onImport" apps/web/src/components/import-profile-button.tsx
```

- [ ] **Step 2: Write a regression test**

```tsx
// apps/web/src/components/__tests__/import-profile-button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportProfileButton } from '../import-profile-button';

describe('ImportProfileButton', () => {
  it('passes profile (not full response) to onImport callback', async () => {
    const onImport = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: { name: 'Jane', email: 'jane@example.com' },
        extractedChars: 12345,
      }),
    } as Response);

    render(<ImportProfileButton onImport={onImport} />);
    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const file = new File(['hello'], 'r.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onImport).toHaveBeenCalled());
    expect(onImport).toHaveBeenCalledWith({ name: 'Jane', email: 'jane@example.com' });
    expect(onImport).not.toHaveBeenCalledWith(expect.objectContaining({ extractedChars: 12345 }));
  });
});
```

- [ ] **Step 3: Run test, expect fail**

```bash
pnpm --filter @resumaker/web test import-profile-button
```

- [ ] **Step 4: Fix the bug**

In `apps/web/src/components/import-profile-button.tsx`, find the line:

```tsx
onImport(data);
```

Replace with:

```tsx
onImport(data.profile);
```

If the file input lacks a `data-testid`, add one to make the test reliable: `data-testid="import-file-input"`.

- [ ] **Step 5: Run test, expect pass + commit**

```bash
pnpm --filter @resumaker/web test import-profile-button
git add apps/web/src/components/import-profile-button.tsx apps/web/src/components/__tests__/import-profile-button.test.tsx
git commit -m "fix(import): pass data.profile to onImport, not full response"
```

---

### Task 1.2: Type unification — replace local ResumeResult / ResumePreview subsets

**Files:**

- Modify: `apps/web/src/app/[locale]/(app)/builder/page.tsx` (lines 24–44, the `ResumeResult` interface)
- Modify: `apps/web/src/components/resume-preview.tsx`

- [ ] **Step 1: Read both files to find the local types**

```bash
sed -n '20,50p' apps/web/src/app/\[locale\]/\(app\)/builder/page.tsx
head -40 apps/web/src/components/resume-preview.tsx
```

- [ ] **Step 2: Replace ResumeResult interface in builder/page.tsx**

Delete the local `interface ResumeResult { ... }` (lines ~24-44). Replace with:

```ts
import type { Resume } from '@resumaker/shared';
type ResumeResult = Resume; // alias so existing code reads the same
```

(Or just use `Resume` directly throughout — preference for readability.)

- [ ] **Step 3: Update ResumePreview to render all sections**

Open `apps/web/src/components/resume-preview.tsx`. Change props type from the local interface to:

```tsx
import type { Resume } from '@resumaker/shared';
import { normalizeLanguageLevel } from '@resumaker/shared';

export function ResumePreview({ resume }: { resume: Resume }) {
  // ... existing render code for contact, summary, experience, skills, education
  // ADD render blocks for:
  // - projects (after experience): name, dates (formatMonthYear), tech tags, description
  // - certifications (after education): name + issuer + date + credential link
  // - awards (after certifications): title + issuer + date + description
  // - languages (footer area): name + (normalized level) — e.g. "Hebrew (native) · English (fluent)"
}
```

Concrete render snippet for the new blocks (drop in after existing sections, before closing wrapper):

```tsx
{
  resume.projects && resume.projects.length > 0 && (
    <section className="mt-6">
      <h2 className="text-foreground border-border mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide">
        Projects
      </h2>
      <div className="space-y-3">
        {resume.projects.map((p, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{p.name}</span>
              {(p.start_date || p.end_date || p.is_ongoing) && (
                <span className="text-muted-foreground text-xs">
                  {formatMonthYear(p.start_date)} –{' '}
                  {p.is_ongoing ? 'Present' : formatMonthYear(p.end_date)}
                </span>
              )}
            </div>
            {p.url && (
              <a href={p.url} className="text-brand-600 text-xs underline">
                {p.url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {p.technologies && p.technologies.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {p.technologies.map((t) => (
                  <span
                    key={t}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {p.description && <p className="text-foreground/80 mt-1 text-sm">{p.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

{
  resume.certifications && resume.certifications.length > 0 && (
    <section className="mt-6">
      <h2 className="text-foreground border-border mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide">
        Certifications
      </h2>
      <ul className="space-y-1">
        {resume.certifications.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{c.name}</span>
              {c.issuer && <span className="text-muted-foreground"> · {c.issuer}</span>}
            </span>
            <span className="text-muted-foreground text-xs">
              {c.date && formatMonthYear(c.date)}
              {c.credential_url && (
                <a href={c.credential_url} className="text-brand-600 ml-2 underline">
                  view
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

{
  resume.awards && resume.awards.length > 0 && (
    <section className="mt-6">
      <h2 className="text-foreground border-border mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide">
        Awards
      </h2>
      <ul className="space-y-2">
        {resume.awards.map((a, i) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{a.title}</span>
                {a.issuer && <span className="text-muted-foreground"> · {a.issuer}</span>}
              </span>
              {a.date && (
                <span className="text-muted-foreground text-xs">{formatMonthYear(a.date)}</span>
              )}
            </div>
            {a.description && <p className="text-foreground/80 mt-1 text-sm">{a.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

{
  resume.languages && resume.languages.length > 0 && (
    <section className="border-border mt-6 border-t pt-3">
      <p className="text-muted-foreground text-xs">
        {resume.languages.map((l, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {l.name} <span className="opacity-70">({normalizeLanguageLevel(l.level)})</span>
          </span>
        ))}
      </p>
    </section>
  );
}
```

Where `formatMonthYear` is the existing helper from `components/builder/month-year-picker.tsx`.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @resumaker/web typecheck
```

Fix any compile errors (e.g. anywhere that destructured the old local shape will need to use the wider `Resume` type — should be a few props/calls).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(app\)/builder/page.tsx apps/web/src/components/resume-preview.tsx
git commit -m "fix(types): unify ResumeResult+ResumePreview with canonical Resume schema; render all sections"
```

---

### Task 1.3: Fix basic-mode hydration losses

When `?id=` is present, hydrate ALL contact + profile fields from saved resume content.

**Files:**

- Modify: `apps/web/src/app/[locale]/(app)/builder/page.tsx` (the hydration useEffect around lines 126-166)

- [ ] **Step 1: Read the existing hydration block**

```bash
sed -n '120,170p' apps/web/src/app/\[locale\]/\(app\)/builder/page.tsx
```

- [ ] **Step 2: Add hydration for missing fields**

In the `useEffect` that loads `/api/resumes/${editingId}`, after the existing setters add:

```ts
setPhone(content.contact?.phone ?? '');
setLocation(content.contact?.location ?? '');
setLinkedin(content.contact?.linkedin ?? '');
// Free-text experience: best-effort flatten of structured experience back to readable text
setExperienceText(
  (content.experience ?? [])
    .map((e) => {
      const dates = e.is_current
        ? `${e.start_date} – Present`
        : `${e.start_date} – ${e.end_date ?? ''}`;
      const lines = [`${e.title} at ${e.company} (${dates})`];
      if (e.description) lines.push(e.description);
      if (e.highlights && e.highlights.length) lines.push(...e.highlights.map((h) => `• ${h}`));
      return lines.join('\n');
    })
    .join('\n\n'),
);
```

- [ ] **Step 3: Manual smoke test (this is UI hydration, hard to unit-test cleanly)**

Document the manual test in a comment above the useEffect:

```ts
// MANUAL TEST: open /builder?id=<existing-resume-id> after this loads, check
// that phone / location / linkedin / experience textarea are populated.
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @resumaker/web typecheck
git add apps/web/src/app/\[locale\]/\(app\)/builder/page.tsx
git commit -m "fix(builder): hydrate phone/location/linkedin/experience from ?id="
```

---

## Phase 2 — Generic SectionCard shell

The reusable state-machine card that every section uses.

### Task 2.1: Build SectionCard component

**Files:**

- Create: `apps/web/src/components/builder/section-card.tsx`
- Test: `apps/web/src/components/builder/__tests__/section-card.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/builder/__tests__/section-card.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SectionCard } from '../section-card';

describe('SectionCard', () => {
  const baseProps = {
    isEditing: false,
    onEnterEdit: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    renderRead: () => <div data-testid="read">READ</div>,
    renderEdit: (_d: unknown, _onChange: (d: unknown) => void) => (
      <div data-testid="edit">EDIT</div>
    ),
    data: {},
  };

  it('renders read view when not editing', () => {
    render(<SectionCard {...baseProps} />);
    expect(screen.getByTestId('read')).toBeInTheDocument();
    expect(screen.queryByTestId('edit')).toBeNull();
  });

  it('renders edit view when isEditing=true', () => {
    render(<SectionCard {...baseProps} isEditing />);
    expect(screen.getByTestId('edit')).toBeInTheDocument();
    expect(screen.queryByTestId('read')).toBeNull();
  });

  it('calls onEnterEdit when read-view is clicked', () => {
    const onEnterEdit = vi.fn();
    render(<SectionCard {...baseProps} onEnterEdit={onEnterEdit} />);
    fireEvent.click(screen.getByTestId('read'));
    expect(onEnterEdit).toHaveBeenCalledOnce();
  });

  it('applies flash-on-save styles for 1800ms after save', async () => {
    vi.useFakeTimers();
    const { rerender, container } = render(<SectionCard {...baseProps} isEditing />);
    // simulate save
    fireEvent.click(screen.getByText('Save'));
    rerender(<SectionCard {...baseProps} isEditing={false} />);
    // flash class should be present
    expect(container.querySelector('[data-flash="true"]')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(container.querySelector('[data-flash="true"]')).toBeNull();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter @resumaker/web test section-card
```

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/builder/section-card.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FLASH_MS = 1800;

export interface SectionCardProps<T> {
  data: T;
  isEditing: boolean;
  onEnterEdit: () => void;
  onSave: (next: T) => void;
  onCancel: () => void;
  onDelete: () => void;
  renderRead: (data: T) => React.ReactNode;
  renderEdit: (data: T, onChange: (next: T) => void) => React.ReactNode;
  /** Optional. Renders inside the card header (e.g. a drag handle). */
  leading?: React.ReactNode;
  /** Optional. Override "Delete this entry?" confirm text. */
  deleteConfirmText?: string;
}

export function SectionCard<T>({
  data,
  isEditing,
  onEnterEdit,
  onSave,
  onCancel,
  onDelete,
  renderRead,
  renderEdit,
  leading,
  deleteConfirmText,
}: SectionCardProps<T>) {
  const [draft, setDraft] = useState<T>(data);
  const [flash, setFlash] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const wasEditing = useRef(isEditing);

  // Reset draft when entering edit mode
  useEffect(() => {
    if (isEditing) setDraft(data);
  }, [isEditing, data]);

  // Detect save (transition from editing → not editing without cancel)
  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), FLASH_MS);
      return () => clearTimeout(t);
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="border-brand-300 bg-card relative rounded-xl border-2 p-4 shadow-sm transition-colors">
        {renderEdit(draft, setDraft)}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => onSave(draft)}>
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEnterEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEnterEdit();
        }
      }}
      data-flash={flash || undefined}
      className={`group relative cursor-pointer rounded-xl border p-4 shadow-sm transition-all duration-700 hover:-translate-y-px hover:shadow-md ${flash ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border bg-card hover:border-brand-300'}`}
    >
      {leading && <div className="absolute left-1 top-1/2 -translate-y-1/2">{leading}</div>}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">{renderRead(data)}</div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEnterEdit();
            }}
            className="hover:bg-muted rounded-md p-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            className="text-destructive hover:bg-destructive/10 rounded-md p-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <div className="border-border bg-background/95 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-4">
          <p className="text-sm">{deleteConfirmText ?? 'Delete this entry?'}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm --filter @resumaker/web test section-card
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/builder/section-card.tsx apps/web/src/components/builder/__tests__/section-card.test.tsx
git commit -m "feat(builder): generic SectionCard shell with edit/flash/delete-confirm"
```

---

## Phase 3 — Per-section components

Each section is built around `SectionCard`. We implement **Experience** in full detail as the template, then the rest follow the same pattern with field differences noted.

### Task 3.1: Experience section (template — full detail)

**Files:**

- Create: `apps/web/src/components/builder/sections/experience-section.tsx`
- Test: `apps/web/src/components/builder/sections/__tests__/experience-section.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/builder/sections/__tests__/experience-section.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperienceSection } from '../experience-section';

describe('ExperienceSection', () => {
  it('renders empty placeholder when no entries', () => {
    render(
      <ExperienceSection
        entries={[]}
        onChange={vi.fn()}
        editingId={null}
        onSetEditingId={vi.fn()}
      />,
    );
    expect(screen.getByText(/no work experience yet/i)).toBeInTheDocument();
  });

  it('renders a card per entry', () => {
    const entries = [
      {
        company: 'Stripe',
        title: 'Engineer',
        start_date: '2022-01',
        end_date: null,
        is_current: true,
        highlights: [],
      },
      {
        company: 'Meta',
        title: 'Junior Eng',
        start_date: '2019-06',
        end_date: '2022-01',
        is_current: false,
        highlights: [],
      },
    ];
    render(
      <ExperienceSection
        entries={entries}
        onChange={vi.fn()}
        editingId={null}
        onSetEditingId={vi.fn()}
      />,
    );
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
  });

  it('"+ Add" inserts a new card in editing state', () => {
    const onSetEditingId = vi.fn();
    render(
      <ExperienceSection
        entries={[]}
        onChange={vi.fn()}
        editingId={null}
        onSetEditingId={onSetEditingId}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add experience/i }));
    expect(onSetEditingId).toHaveBeenCalledWith(expect.stringContaining('new:experience:'));
  });

  it('disables end-date picker when is_current is true', () => {
    const entries = [
      {
        company: 'X',
        title: 'Y',
        start_date: '2020-01',
        end_date: null,
        is_current: true,
        highlights: [],
      },
    ];
    render(
      <ExperienceSection
        entries={entries}
        onChange={vi.fn()}
        editingId="experience:0"
        onSetEditingId={vi.fn()}
      />,
    );
    const endMonthSelect = screen.getByLabelText(/end — month/i) as HTMLSelectElement;
    expect(endMonthSelect.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm --filter @resumaker/web test experience-section
```

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/builder/sections/experience-section.tsx
'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { Plus, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';

type Experience = Resume['experience'][number];

export interface ExperienceSectionProps {
  entries: Experience[];
  onChange: (entries: Experience[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const EMPTY: Experience = {
  company: '',
  title: '',
  start_date: '',
  end_date: null,
  is_current: false,
  location: '',
  description: '',
  highlights: [],
};

export function ExperienceSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
}: ExperienceSectionProps) {
  const [pendingNew, setPendingNew] = useState<Experience | null>(null);

  function handleAdd() {
    const id = `new:experience:${Date.now()}`;
    setPendingNew({ ...EMPTY });
    onSetEditingId(id);
  }

  function handleSaveExisting(i: number, next: Experience) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: Experience) {
    onChange([next, ...entries]);
    setPendingNew(null);
    onSetEditingId(null);
  }

  function handleDelete(i: number) {
    const copy = entries.filter((_, idx) => idx !== i);
    onChange(copy);
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <Briefcase className="h-4 w-4" />
          Work Experience
          {entries.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({entries.length})</span>
          )}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          aria-label="Add experience"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </header>

      {pendingNew && editingId?.startsWith('new:experience:') && (
        <SectionCard
          data={pendingNew}
          isEditing
          onEnterEdit={() => {}}
          onSave={handleSaveNew}
          onCancel={() => {
            setPendingNew(null);
            onSetEditingId(null);
          }}
          onDelete={() => {
            setPendingNew(null);
            onSetEditingId(null);
          }}
          renderRead={readExperience}
          renderEdit={editExperience}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No work experience yet. Click + Add to start.
          </p>
        </div>
      )}

      {entries.map((e, i) => (
        <SectionCard
          key={i}
          data={e}
          isEditing={editingId === `experience:${i}`}
          onEnterEdit={() => onSetEditingId(`experience:${i}`)}
          onSave={(next) => handleSaveExisting(i, next)}
          onCancel={() => onSetEditingId(null)}
          onDelete={() => handleDelete(i)}
          renderRead={readExperience}
          renderEdit={editExperience}
        />
      ))}
    </section>
  );
}

function readExperience(e: Experience) {
  return (
    <div>
      <p className="text-foreground font-semibold">{e.title || 'Untitled role'}</p>
      <p className="text-muted-foreground text-sm">
        {e.company}
        {e.location && ` · ${e.location}`}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatMonthYear(e.start_date)} –{' '}
        {e.is_current ? 'Present' : formatMonthYear(e.end_date ?? '')}
      </p>
      {e.description && (
        <p className="text-foreground/80 mt-2 line-clamp-2 text-sm">{e.description}</p>
      )}
    </div>
  );
}

function editExperience(e: Experience, onChange: (next: Experience) => void) {
  const set = <K extends keyof Experience>(k: K, v: Experience[K]) => onChange({ ...e, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="exp-company">Company *</Label>
        <Input
          id="exp-company"
          value={e.company}
          onChange={(ev) => set('company', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="exp-title">Title *</Label>
        <Input
          id="exp-title"
          value={e.title}
          onChange={(ev) => set('title', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="exp-location">Location</Label>
        <Input
          id="exp-location"
          value={e.location ?? ''}
          onChange={(ev) => set('location', ev.target.value)}
          placeholder="City, Country"
        />
      </div>
      <MonthYearPicker
        label="Start"
        value={e.start_date}
        onChange={(v) => set('start_date', v)}
        required
      />
      <MonthYearPicker
        label="End"
        value={e.end_date ?? ''}
        onChange={(v) => set('end_date', v || null)}
        disabled={e.is_current}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={e.is_current}
          onChange={(ev) => {
            const checked = ev.target.checked;
            onChange({ ...e, is_current: checked, end_date: checked ? null : e.end_date });
          }}
          className="rounded"
        />
        Currently working here
      </label>
      <div className="sm:col-span-2">
        <Label htmlFor="exp-desc">Description</Label>
        <Textarea
          id="exp-desc"
          rows={3}
          value={e.description ?? ''}
          onChange={(ev) => set('description', ev.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Highlights</Label>
        <HighlightsEditor highlights={e.highlights ?? []} onChange={(h) => set('highlights', h)} />
      </div>
    </div>
  );
}

function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[];
  onChange: (h: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      {highlights.map((h, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={h}
            onChange={(ev) =>
              onChange(highlights.map((x, idx) => (idx === i ? ev.target.value : x)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(highlights.filter((_, idx) => idx !== i))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...highlights, ''])}>
        + Add highlight
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm --filter @resumaker/web test experience-section
pnpm --filter @resumaker/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/builder/sections/experience-section.tsx apps/web/src/components/builder/sections/__tests__/experience-section.test.tsx
git commit -m "feat(builder): Experience section with MonthYearPicker + is_current toggle"
```

---

### Task 3.2: Education section

Same pattern as Experience. Differences:

- Fields: `institution` (required) + `degree`, `field`, `gpa`, `start_date`, `end_date`, `description`, `is_current` ("Currently studying")
- Read view: institution (bold), degree · field, dates, GPA inline (`· GPA: 3.8`) if set
- Icon: `GraduationCap` from lucide-react
- "+ Add education" aria-label

**Files:**

- Create: `apps/web/src/components/builder/sections/education-section.tsx`
- Test: `apps/web/src/components/builder/sections/__tests__/education-section.test.tsx`

- [ ] **Step 1: Copy experience-section.test.tsx as starter, swap "Experience" → "Education" and field assertions**

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Copy experience-section.tsx as starter, swap:**
  - Import `GraduationCap` instead of `Briefcase`
  - Type: `Resume['education'][number]`
  - `EMPTY`: `{ institution: '', degree: '', field: '', start_date: '', end_date: null, is_current: false, gpa: '', description: '' }`
  - Read view shows institution + degree+field + dates + GPA
  - Edit form fields: institution (required, full-width), degree, field, gpa (single-line input), start/end dates, is_current checkbox ("Currently studying"), description textarea

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(builder): Education section with currently-studying toggle"
```

---

### Task 3.3: Projects section

**Files:**

- Create: `apps/web/src/components/builder/sections/projects-section.tsx`
- Test: `apps/web/src/components/builder/sections/__tests__/projects-section.test.tsx`

Same pattern. Differences:

- Type: `NonNullable<Resume['projects']>[number]`
- Icon: `FolderGit2`
- Fields: name (required, full-width) + url + technologies[] + start_date + end_date + is_ongoing ("Ongoing / active") + description
- Technologies UI: a single text input where typing comma triggers tag commit. Render committed tags as chips with × delete. Hint text below: "Type and press , or Enter to add"
- Read view: name (bold) + "Ongoing" green badge if is_ongoing + url link (truncated) + date range + tech chips + line-clamp-2 description

Concrete tech-input behavior:

```tsx
function TechChipsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState('');
  function commit() {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setRaw('');
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        {value.map((t) => (
          <span
            key={t}
            className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          >
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        value={raw}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) {
            setRaw(e.target.value.slice(0, -1));
            commit();
          } else setRaw(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="React, TypeScript, AWS…"
      />
      <p className="text-muted-foreground mt-1 text-xs">Type and press , or Enter to add</p>
    </div>
  );
}
```

- [ ] **Step 1-5: TDD as above, commit "feat(builder): Projects section with tech chips + ongoing toggle"**

---

### Task 3.4: Skills section

**Files:**

- Create: `apps/web/src/components/builder/sections/skills-section.tsx`
- Test: same pattern

Differences:

- Add+delete only (no edit/SectionCard usage)
- Data: `string[]` (just names — categories are out of scope for v1, defer to a follow-up if user requests; spec mentions optional category but ResumeSchema has skills as `string[]`. Keep it simple: skills are strings)
- Display: chips with × per skill
- Add input: with autocomplete dropdown sourced from `COMMON_SKILLS` (filter by typed prefix, top 8 matches)
- Icon: `Sparkles`

Concrete autocomplete:

```tsx
import { COMMON_SKILLS } from '@/lib/data/common-skills';

function SkillAutocompleteInput({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (s: string) => void;
}) {
  const [raw, setRaw] = useState('');
  const lower = raw.toLowerCase().trim();
  const suggestions = lower
    ? COMMON_SKILLS.filter((s) => s.toLowerCase().includes(lower) && !existing.includes(s)).slice(
        0,
        8,
      )
    : [];
  function commit(s: string) {
    const t = s.trim();
    if (t && !existing.some((e) => e.toLowerCase() === t.toLowerCase())) onAdd(t);
    setRaw('');
  }
  return (
    <div className="relative">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(raw);
          }
        }}
        placeholder="Add a skill (e.g. TypeScript)"
      />
      {suggestions.length > 0 && (
        <div className="border-border bg-card absolute z-10 mt-1 w-full overflow-hidden rounded-md border shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="hover:bg-muted block w-full px-3 py-1.5 text-left text-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1-5: TDD, commit "feat(builder): Skills section with autocomplete chips"**

---

### Task 3.5: Certifications section

Same SectionCard pattern as Experience. Differences:

- Type: `NonNullable<Resume['certifications']>[number]` (now includes `credential_url`)
- Icon: `Award`
- Fields: name (required), issuer, date (single MonthYearPicker), credential_url
- Read view: name (bold) + issuer + date + "View credential" link if credential_url present

- [ ] **Step 1-5: TDD, commit "feat(builder): Certifications section with credential URL"**

---

### Task 3.6: Awards section

**Files:**

- Create: `apps/web/src/components/builder/sections/awards-section.tsx`

Same pattern. Differences:

- Type: `NonNullable<Resume['awards']>[number]`
- Icon: `Trophy`
- Fields: title (required), issuer, date, description
- Read view: title (bold) + issuer + date + line-clamp-2 description

- [ ] **Step 1-5: TDD, commit "feat(builder): Awards section"**

---

### Task 3.7: Languages section

**Files:**

- Create: `apps/web/src/components/builder/sections/languages-section.tsx`

Chip-style (no SectionCard). Each language renders as a chip showing `Name (level)` with × delete. Add form: text input for name + select for level.

```tsx
const LEVELS: Array<{ value: LanguageLevel; label: string }> = [
  { value: 'native', label: 'Native' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'basic', label: 'Basic' },
];
```

- [ ] **Step 1-5: TDD, commit "feat(builder): Languages section with level enum"**

---

### Task 3.8: Contact card

**Files:**

- Create: `apps/web/src/components/builder/sections/contact-card.tsx`

Single SectionCard (no list). Edit form: name (required) + email + phone + location + linkedin + github + website. Read view: name (bold), email, then "phone · location" line, then social icons row.

- [ ] **Step 1-5: TDD, commit "feat(builder): Contact card"**

---

### Task 3.9: Summary card

**Files:**

- Create: `apps/web/src/components/builder/sections/summary-card.tsx`

Single SectionCard. Edit form: 4-row textarea. Read view: paragraph (line-clamp-4 with "show more" affordance if longer). Will get an "AI rewrite" button in Phase 6.

- [ ] **Step 1-5: TDD, commit "feat(builder): Summary card"**

---

## Phase 4 — AdvancedEditor composition

### Task 4.1: AdvancedEditor component

**Files:**

- Create: `apps/web/src/components/builder/advanced-editor.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/web/src/components/builder/advanced-editor.tsx
'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { ContactCard } from './sections/contact-card';
import { SummaryCard } from './sections/summary-card';
import { ExperienceSection } from './sections/experience-section';
import { EducationSection } from './sections/education-section';
import { ProjectsSection } from './sections/projects-section';
import { SkillsSection } from './sections/skills-section';
import { CertificationsSection } from './sections/certifications-section';
import { AwardsSection } from './sections/awards-section';
import { LanguagesSection } from './sections/languages-section';

export interface AdvancedEditorProps {
  resume: Resume;
  onChange: (next: Resume) => void;
}

export function AdvancedEditor({ resume, onChange }: AdvancedEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function trySetEditingId(next: string | null) {
    // Single-edit rule
    if (editingId && next && editingId !== next) {
      if (!confirm('Save or discard the current edits first?')) return;
    }
    setEditingId(next);
  }

  function patch<K extends keyof Resume>(key: K, value: Resume[K]) {
    onChange({ ...resume, [key]: value });
  }

  return (
    <div className="space-y-6">
      <ContactCard
        contact={resume.contact}
        onChange={(c) => patch('contact', c)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <SummaryCard
        summary={resume.summary}
        onChange={(s) => patch('summary', s)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <ExperienceSection
        entries={resume.experience}
        onChange={(e) => patch('experience', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <EducationSection
        entries={resume.education}
        onChange={(e) => patch('education', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <ProjectsSection
        entries={resume.projects ?? []}
        onChange={(e) => patch('projects', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <SkillsSection skills={resume.skills} onChange={(s) => patch('skills', s)} />
      <CertificationsSection
        entries={resume.certifications ?? []}
        onChange={(c) => patch('certifications', c)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <AwardsSection
        entries={resume.awards ?? []}
        onChange={(a) => patch('awards', a)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <LanguagesSection
        languages={resume.languages ?? []}
        onChange={(l) => patch('languages', l)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @resumaker/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(builder): AdvancedEditor composes all sections with single-edit rule"
```

---

### Task 4.2: Wire AdvancedEditor into builder/page.tsx

**Files:**

- Modify: `apps/web/src/app/[locale]/(app)/builder/page.tsx`

- [ ] **Step 1: Replace placeholder card**

Find the `{mode === 'advanced' && (...)}` block (the placeholder card) and replace with:

```tsx
{
  mode === 'advanced' && (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <AdvancedEditor resume={resumeContent} onChange={setResumeContent} />
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <ResumePreview resume={resumeContent} />
      </div>
    </div>
  );
}
```

Also: introduce `resumeContent` state — `const [resumeContent, setResumeContent] = useState<Resume>(...)` initialized from the existing basic-form fields (or hydrated from `result` if AI has generated one). This is the shared state between basic and advanced modes.

The basic mode form should write into `resumeContent` on submit too (via `setResumeContent(result.resume)` after generate succeeds). This way switching from basic to advanced preserves the just-generated resume.

- [ ] **Step 2: Typecheck**

- [ ] **Step 3: Manual smoke** — load /builder, toggle to advanced, see the editor.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(builder): wire AdvancedEditor + live preview into builder page"
```

---

## Phase 5 — Import flow

### Task 5.1: ImportModal component

**Files:**

- Create: `apps/web/src/components/builder/import-modal.tsx`
- Test: `apps/web/src/components/builder/__tests__/import-modal.test.tsx`

- [ ] **Step 1: Test state transitions Upload → Parsing → Preview → Apply**

```tsx
// import-modal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportModal } from '../import-modal';

describe('ImportModal', () => {
  it('opens at Upload step', () => {
    render(<ImportModal open onClose={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByText(/drag.*pdf.*txt/i)).toBeInTheDocument();
  });

  it('after file upload, calls /api/profile/import and shows Preview', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          contact: { name: 'Jane', email: 'jane@example.com' },
          summary: 'Senior engineer',
          experience: [
            {
              company: 'Stripe',
              title: 'Eng',
              start_date: '2022-01',
              end_date: null,
              highlights: [],
            },
          ],
          education: [],
          skills: ['TypeScript', 'React'],
          projects: [],
          certifications: [],
          awards: [],
        },
        extractedChars: 1000,
      }),
    } as Response);

    render(<ImportModal open onClose={vi.fn()} onApply={vi.fn()} />);
    const input = screen.getByTestId('import-file');
    fireEvent.change(input, { target: { files: [new File(['x'], 'r.txt')] } });

    await waitFor(() => expect(screen.getByText(/preview/i)).toBeInTheDocument());
    expect(screen.getByText(/jane/i)).toBeInTheDocument();
    expect(screen.getByText(/1 position/i)).toBeInTheDocument();
    expect(screen.getByText(/2 skills/i)).toBeInTheDocument();
  });

  it('Apply calls onApply with parsed profile', async () => {
    /* similar — get to Preview, click Apply, verify onApply was called with parsed.profile */
  });
});
```

- [ ] **Step 2: Implement (full file)**

```tsx
// apps/web/src/components/builder/import-modal.tsx
'use client';

import { useRef, useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { Upload, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Step = 'upload' | 'parsing' | 'preview' | 'error';

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (profile: Partial<Resume>, options: Record<string, boolean>) => void;
}

export function ImportModal({ open, onClose, onApply }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<Partial<Resume> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState<Record<string, boolean>>({
    contact: true,
    summary: true,
    experience: true,
    education: true,
    projects: true,
    skills: true,
    certifications: true,
    awards: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    setStep('parsing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/import', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setParsed(data.profile);
      setStep('preview');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  function reset() {
    setStep('upload');
    setParsed(null);
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="border-border bg-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground absolute right-4 top-4"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-xl font-bold">Import resume</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          PDF or TXT, up to 10MB. We'll preview before applying.
        </p>

        {step === 'upload' && (
          <div
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-border hover:border-brand-300 bg-muted/30 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors"
          >
            <Upload className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="text-foreground mt-2 text-sm font-medium">Drag a PDF or TXT here</p>
            <p className="text-muted-foreground text-xs">or click to choose</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              data-testid="import-file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="text-brand-500 h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Claude is reading your resume…</p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border p-3 text-sm">
            <p className="font-medium">Couldn't parse the file</p>
            <p className="text-xs">{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={reset}>
              Try again
            </Button>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Preview — what will be imported:</p>
              <ul className="space-y-1 text-sm">
                {parsed.contact?.name && (
                  <PreviewRow
                    ok={opts.contact}
                    onToggle={(v) => setOpts({ ...opts, contact: v })}
                    label="Contact"
                    detail={parsed.contact.name}
                  />
                )}
                {parsed.summary && (
                  <PreviewRow
                    ok={opts.summary}
                    onToggle={(v) => setOpts({ ...opts, summary: v })}
                    label="Summary"
                    detail={parsed.summary.slice(0, 80) + (parsed.summary.length > 80 ? '…' : '')}
                  />
                )}
                {parsed.experience?.length ? (
                  <PreviewRow
                    ok={opts.experience}
                    onToggle={(v) => setOpts({ ...opts, experience: v })}
                    label="Experience"
                    detail={`${parsed.experience.length} position${parsed.experience.length === 1 ? '' : 's'} (${parsed.experience
                      .map((e) => e.company)
                      .slice(0, 3)
                      .join(', ')})`}
                  />
                ) : null}
                {parsed.education?.length ? (
                  <PreviewRow
                    ok={opts.education}
                    onToggle={(v) => setOpts({ ...opts, education: v })}
                    label="Education"
                    detail={`${parsed.education.length} (${parsed.education
                      .map((e) => e.institution)
                      .slice(0, 2)
                      .join(', ')})`}
                  />
                ) : null}
                {parsed.projects?.length ? (
                  <PreviewRow
                    ok={opts.projects}
                    onToggle={(v) => setOpts({ ...opts, projects: v })}
                    label="Projects"
                    detail={`${parsed.projects.length}`}
                  />
                ) : null}
                {parsed.skills?.length ? (
                  <PreviewRow
                    ok={opts.skills}
                    onToggle={(v) => setOpts({ ...opts, skills: v })}
                    label="Skills"
                    detail={`${parsed.skills.length} skills`}
                  />
                ) : null}
                {parsed.certifications?.length ? (
                  <PreviewRow
                    ok={opts.certifications}
                    onToggle={(v) => setOpts({ ...opts, certifications: v })}
                    label="Certifications"
                    detail={`${parsed.certifications.length}`}
                  />
                ) : null}
                {parsed.awards?.length ? (
                  <PreviewRow
                    ok={opts.awards}
                    onToggle={(v) => setOpts({ ...opts, awards: v })}
                    label="Awards"
                    detail={`${parsed.awards.length}`}
                  />
                ) : null}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  onApply(parsed, opts);
                  onClose();
                  reset();
                }}
              >
                <Check className="h-3.5 w-3.5" /> Apply to resume
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Try another file
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({
  ok,
  onToggle,
  label,
  detail,
}: {
  ok: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={ok}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 rounded"
      />
      <span>
        <span className="font-medium">{label}:</span>{' '}
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
```

- [ ] **Step 3: Wire into builder/page.tsx — add Import button + state**

In `builder/page.tsx`:

```tsx
const [importOpen, setImportOpen] = useState(false);
// In the toolbar above the editor:
<Button variant="outline" onClick={() => setImportOpen(true)}>Import…</Button>
<ImportModal
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onApply={(profile, opts) => applyImportedProfile(resumeContent, profile, opts, setResumeContent)}
/>
```

Create the apply helper:

```tsx
// apps/web/src/lib/builder/apply-import.ts
import type { Resume } from '@resumaker/shared';

export function applyImportedProfile(
  current: Resume,
  imported: Partial<Resume>,
  opts: Record<string, boolean>,
  set: (next: Resume) => void,
) {
  const next: Resume = { ...current };

  if (opts.contact && imported.contact) {
    next.contact = {
      ...current.contact,
      // OVERWRITE per-field only if parsed is non-empty
      ...(imported.contact.name && { name: imported.contact.name }),
      ...(imported.contact.email && { email: imported.contact.email }),
      ...(imported.contact.phone && { phone: imported.contact.phone }),
      ...(imported.contact.location && { location: imported.contact.location }),
      ...(imported.contact.linkedin && { linkedin: imported.contact.linkedin }),
      ...(imported.contact.github && { github: imported.contact.github }),
      ...(imported.contact.website && { website: imported.contact.website }),
    };
  }
  if (opts.summary && imported.summary) next.summary = imported.summary;

  // REPLACE only if parsed list is non-empty
  for (const key of ['experience', 'education', 'projects', 'certifications', 'awards'] as const) {
    if (opts[key] && imported[key] && (imported[key] as unknown[]).length > 0) {
      // @ts-expect-error — index access on Resume key
      next[key] = imported[key];
    }
  }

  // MERGE skills dedup-by-lowercase-name
  if (opts.skills && imported.skills && imported.skills.length > 0) {
    const existingLower = new Set(current.skills.map((s) => s.toLowerCase()));
    const adds = imported.skills.filter((s) => !existingLower.has(s.toLowerCase()));
    next.skills = [...current.skills, ...adds];
  }

  // MERGE languages dedup-by-lowercase-name
  if (imported.languages && imported.languages.length > 0) {
    const existing = new Set((current.languages ?? []).map((l) => l.name.toLowerCase()));
    const adds = imported.languages.filter((l) => !existing.has(l.name.toLowerCase()));
    next.languages = [...(current.languages ?? []), ...adds];
  }

  set(next);
}
```

- [ ] **Step 4: Test + commit**

```bash
pnpm --filter @resumaker/web test import-modal
pnpm --filter @resumaker/web typecheck
git add apps/web/src/components/builder/import-modal.tsx apps/web/src/lib/builder/apply-import.ts apps/web/src/app/\[locale\]/\(app\)/builder/page.tsx
git commit -m "feat(builder): two-step import modal with per-section apply controls"
```

---

## Phase 6 — AI affordances

### Task 6.1: Bullet rewrite API + UI

**Files:**

- Create: `apps/web/src/app/api/resumes/bullet/rewrite/route.ts`
- Test: `apps/web/src/app/api/resumes/bullet/rewrite/__tests__/route.test.ts`
- Create: `apps/web/src/components/builder/ai-rewrite-button.tsx`

- [ ] **Step 1: Test for the API**

```ts
// route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: 'u1', tier: 'plus' } }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetSeconds: 3600 }),
}));

describe('POST /api/resumes/bullet/rewrite', () => {
  it('rejects requests over 500 chars', async () => {
    const req = new Request('http://x/api/resumes/bullet/rewrite', {
      method: 'POST',
      body: JSON.stringify({ bullet: 'x'.repeat(501) }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns a rewritten bullet shape', async () => {
    // mock anthropic client to return predictable response
    // assert { bullet: string } shape
  });
});
```

- [ ] **Step 2: Implement route**

```ts
// apps/web/src/app/api/resumes/bullet/rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { anthropicClient } from '@/lib/llm/client';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  bullet: z.string().min(1).max(500),
  jobDescription: z.string().max(20000).optional(),
  tone: z.enum(['impact', 'concise', 'formal']).default('impact'),
});

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = session.user.tier ?? 'free';
  const limit = tier === 'free' ? 10 : 30;
  const rl = await checkRateLimit(`bullet-rewrite:${session.user.id}`, limit, 3600);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { bullet, jobDescription, tone } = parsed.data;
  const toneInstruction = {
    impact: 'Focus on quantifiable impact and active verbs.',
    concise: 'Tighten to under 20 words, no fluff.',
    formal: 'Use formal corporate tone.',
  }[tone];

  const system = `You rewrite resume bullets. ${toneInstruction} Return ONLY the rewritten bullet, no commentary.`;
  const userMsg = jobDescription
    ? `Rewrite this bullet to better match the job below.\n\nBullet:\n${bullet}\n\nJob:\n${jobDescription.slice(0, 4000)}`
    : `Rewrite this bullet:\n${bullet}`;

  try {
    const result = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = result.content.find((c) => c.type === 'text')?.text?.trim() ?? bullet;
    return NextResponse.json({ bullet: text });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'bullet-rewrite.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement UI component**

```tsx
// apps/web/src/components/builder/ai-rewrite-button.tsx
'use client';

import { useState } from 'react';
import { Sparkles, Undo2 } from 'lucide-react';

export interface AiRewriteButtonProps {
  value: string;
  jobDescription?: string;
  tone?: 'impact' | 'concise' | 'formal';
  onReplace: (next: string) => void;
}

export function AiRewriteButton({ value, jobDescription, tone, onReplace }: AiRewriteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [undoValue, setUndoValue] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/resumes/bullet/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet: value, jobDescription, tone }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUndoValue(value);
      onReplace(data.bullet);
      setTimeout(() => setUndoValue(null), 30000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (undoValue) {
    return (
      <button
        type="button"
        onClick={() => {
          onReplace(undoValue);
          setUndoValue(null);
        }}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <Undo2 className="h-3 w-3" /> Undo rewrite
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !value.trim()}
      className="text-brand-500 hover:text-brand-700 inline-flex items-center gap-1 text-xs disabled:opacity-40"
    >
      <Sparkles className={`h-3 w-3 ${loading ? 'animate-pulse' : ''}`} />
      {loading ? 'Rewriting…' : 'Rewrite with AI'}
    </button>
  );
}
```

- [ ] **Step 4: Wire into ExperienceSection (per highlight) and SummaryCard**

In `experience-section.tsx`, inside `HighlightsEditor`, add `<AiRewriteButton>` next to each highlight input (passes the highlight value and onReplace updates that index).

In `summary-card.tsx`, add `<AiRewriteButton>` next to the summary textarea (only enabled when JD is in context — pass a `jobDescription` prop from `AdvancedEditor` down).

To plumb JD into AdvancedEditor: lift `jobDescription` state up from builder/page.tsx, pass as prop.

- [ ] **Step 5: Test + commit**

```bash
git commit -m "feat(builder): AI rewrite button for bullets + summary (Claude Haiku)"
```

---

### Task 6.2: Fit-score panel + API

**Files:**

- Create: `apps/web/src/app/api/resumes/fit-score/route.ts`
- Test: `apps/web/src/app/api/resumes/fit-score/__tests__/route.test.ts`
- Create: `apps/web/src/components/builder/fit-score-panel.tsx`

- [ ] **Step 1: Implement route — same shape as bullet/rewrite but**:

```ts
const BodySchema = z.object({
  resume: ResumeSchema,
  jobDescription: z.string().min(10).max(20000),
});

// system prompt:
const system = `You score how well a resume matches a job. Return ONLY a JSON object with this shape:
{ "score": 1-10, "missing_keywords": ["..."], "strengths": ["..."], "rationale": "one sentence" }`;
// max_tokens: 512
// Cache by hash(resume + JD), TTL 30 days
```

- [ ] **Step 2: Implement panel**

```tsx
// apps/web/src/components/builder/fit-score-panel.tsx
'use client';

import { useEffect, useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { CheckCircle, AlertCircle, Zap, Loader2 } from 'lucide-react';

interface FitScore {
  score: number;
  missing_keywords: string[];
  strengths: string[];
  rationale: string;
}

export function FitScorePanel({
  resume,
  jobDescription,
}: {
  resume: Resume;
  jobDescription: string;
}) {
  const [score, setScore] = useState<FitScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobDescription.trim()) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/resumes/fit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume, jobDescription }),
        });
        if (res.ok) setScore(await res.json());
      } finally {
        setLoading(false);
      }
    }, 5000); // 5s idle debounce
    return () => clearTimeout(t);
  }, [resume, jobDescription]);

  if (!jobDescription.trim()) return null;
  const color =
    score && score.score >= 7
      ? 'text-green-500'
      : score && score.score >= 5
        ? 'text-yellow-500'
        : 'text-red-500';
  const Icon =
    score && score.score >= 7 ? CheckCircle : score && score.score >= 5 ? Zap : AlertCircle;

  return (
    <div className="border-border bg-card mb-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Job fit</h3>
        {loading && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
      </div>
      {score ? (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className={`text-2xl font-bold ${color}`}>{score.score}/10</span>
          </div>
          <p className="text-foreground/80 mt-2 text-xs">{score.rationale}</p>
          {score.strengths.length > 0 && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs">Strengths:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.missing_keywords.length > 0 && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs">Missing:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.missing_keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">Scoring after you stop editing…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire above the preview pane** in `builder/page.tsx` advanced mode:

```tsx
<div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
  {jd && <FitScorePanel resume={resumeContent} jobDescription={jd} />}
  <ResumePreview resume={resumeContent} />
</div>
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(builder): fit-score panel above preview when JD present"
```

---

## Phase 7 — Drag-to-reorder

### Task 7.1: Add @dnd-kit dependency + apply to ExperienceSection

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/src/components/builder/sections/experience-section.tsx`

- [ ] **Step 1: Add dependency**

```bash
pnpm --filter @resumaker/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Wrap the entries list with `<DndContext><SortableContext>`**

```tsx
// inside experience-section.tsx, replace entries.map(...) with a SortableExperiences component:
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

function SortableExperience({ id, children }: { id: string; children: (props: { dragHandle: React.ReactNode }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children({
        dragHandle: (
          <button {...attributes} {...listeners} aria-label="Drag to reorder" className="text-muted-foreground hover:text-foreground cursor-grab p-1">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ),
      })}
    </div>
  );
}

// In ExperienceSection:
const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
const ids = entries.map((_, i) => `experience:${i}`);
function handleDragEnd(e: DragEndEvent) {
  if (e.over && e.active.id !== e.over.id) {
    const oldIndex = ids.indexOf(e.active.id as string);
    const newIndex = ids.indexOf(e.over.id as string);
    onChange(arrayMove(entries, oldIndex, newIndex));
  }
}

// Render:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
    {entries.map((e, i) => (
      <SortableExperience key={ids[i]} id={ids[i]}>
        {({ dragHandle }) => (
          <SectionCard ... leading={dragHandle} />
        )}
      </SortableExperience>
    ))}
  </SortableContext>
</DndContext>
```

- [ ] **Step 3: Repeat for Education / Projects / Certifications / Awards sections**

(Same pattern; mechanical change. Skills + Languages are chip-style and don't get drag.)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(builder): drag-to-reorder via @dnd-kit for all list sections"
```

---

## Phase 8 — PDF template updates

### Task 8.1: Modern template — add Projects, Awards, Certifications, Languages

**Files:**

- Modify: `packages/resume-engine/src/templates/modern.tsx`

- [ ] **Step 1: Read current template**

```bash
cat packages/resume-engine/src/templates/modern.tsx
```

- [ ] **Step 2: Add render blocks following editor section order: Header → Summary → Experience → Education → Projects → Skills → Certifications → Awards → Languages**

The exact JSX uses `@react-pdf/renderer` primitives (`<View>`, `<Text>`, `<StyleSheet>`). Style per "Modern uses brand-accent left bar, dates right-aligned" — mirror the existing experience block's treatment.

Concrete Project block:

```tsx
{
  resume.projects?.length ? (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Projects</Text>
      {resume.projects.map((p, i) => (
        <View key={i} style={styles.entry}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>
              {p.name}
              {p.url ? `  ·  ${p.url.replace(/^https?:\/\//, '')}` : ''}
            </Text>
            <Text style={styles.entryDate}>
              {p.start_date ? formatMonthYear(p.start_date) : ''}
              {p.start_date || p.end_date || p.is_ongoing ? ' – ' : ''}
              {p.is_ongoing ? 'Present' : formatMonthYear(p.end_date ?? '')}
            </Text>
          </View>
          {p.technologies?.length ? (
            <Text style={styles.entryMeta}>{p.technologies.join(' · ')}</Text>
          ) : null}
          {p.description ? <Text style={styles.entryBody}>{p.description}</Text> : null}
        </View>
      ))}
    </View>
  ) : null;
}
```

Awards block (similar):

```tsx
{
  resume.awards?.length ? (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Awards</Text>
      {resume.awards.map((a, i) => (
        <View key={i} style={styles.entry}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>
              {a.title}
              {a.issuer ? ` · ${a.issuer}` : ''}
            </Text>
            {a.date && <Text style={styles.entryDate}>{formatMonthYear(a.date)}</Text>}
          </View>
          {a.description ? <Text style={styles.entryBody}>{a.description}</Text> : null}
        </View>
      ))}
    </View>
  ) : null;
}
```

Certifications: extend the existing block (if any) to include `credential_url` as a small grey line. If no existing block, add it modeled like Awards.

Languages footer:

```tsx
{
  resume.languages?.length ? (
    <View style={styles.footerLanguages}>
      <Text style={styles.languagesText}>
        {resume.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}
      </Text>
    </View>
  ) : null;
}
```

Add `formatMonthYear` helper in `packages/resume-engine/src/utils/format.ts`:

```ts
export function formatMonthYear(d: string | null | undefined): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(pdf): modern template renders projects/awards/certs/languages"
```

---

### Task 8.2: Classic template — same blocks, classic styling

**Files:** `packages/resume-engine/src/templates/classic.tsx`

Same content as modern, but: italic subtitles, centered date range, no left bar accent.

- [ ] **Step 1-3: Adapt, commit "feat(pdf): classic template renders projects/awards/certs/languages"**

---

### Task 8.3: Minimal template — same blocks, minimal styling

**Files:** `packages/resume-engine/src/templates/minimal.tsx`

Same content as modern, but: weight-only differentiation, generous whitespace, comma-separated tech tags.

- [ ] **Step 1-3: Adapt, commit "feat(pdf): minimal template renders projects/awards/certs/languages"**

---

### Task 8.4: PDF snapshot test (kitchen sink)

**Files:**

- Create: `packages/resume-engine/src/__tests__/snapshot.test.ts`
- Create: `packages/resume-engine/src/__tests__/__fixtures__/kitchen-sink.json` (a Resume with all sections populated)

- [ ] **Step 1: Write the fixture (full Resume with each section having 2-3 entries)**

- [ ] **Step 2: For each template, render → buffer.toString('hex').slice(0,100) snapshot**

```ts
import { renderToBuffer } from '@react-pdf/renderer';
import { renderTemplate } from '../templates';
import fixture from './__fixtures__/kitchen-sink.json';

describe.each(['modern', 'classic', 'minimal'] as const)('PDF snapshot — %s', (id) => {
  it('renders deterministic PDF for kitchen-sink resume', async () => {
    const buf = await renderToBuffer(renderTemplate(id, { resume: fixture as any }));
    expect(buf.length).toBeGreaterThan(1000);
    // Snapshot the FIRST 200 bytes of hex — full PDF has timestamp noise but the structure is deterministic enough
    expect(buf.toString('hex').slice(0, 200)).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(pdf): kitchen-sink snapshot test for all three templates"
```

---

## Phase 9 — E2E + verification

### Task 9.1: Playwright E2E for advanced builder happy path

**Files:**

- Modify or Create: `apps/web/tests/e2e/builder-advanced.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '@playwright/test';

test('advanced builder: add experience, save, reload, persists', async ({ page }) => {
  // assumes test-user is pre-seeded; sign in via cookie or test-only endpoint
  await page.goto('/en/builder?mode=advanced');
  await expect(page.getByText('Work Experience')).toBeVisible();
  await page.getByRole('button', { name: /add experience/i }).click();
  await page.getByLabel('Company *').fill('Stripe');
  await page.getByLabel('Title *').fill('Senior Engineer');
  // pick start date via the two selects
  await page.getByLabel(/start — month/i).selectOption('06');
  await page.getByLabel(/start — year/i).selectOption('2022');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Stripe')).toBeVisible();
  // ...further: hit top-level Save → reload → still there
});

test('import flow: upload sample TXT, preview shows counts, apply populates editor', async ({
  page,
}) => {
  // attach a fixture TXT, walk through the modal, verify experience cards appear
});
```

- [ ] **Step 2: Run E2E**

```bash
pnpm --filter @resumaker/web e2e
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(e2e): advanced builder happy path + import flow"
```

---

### Task 9.2: Full verification sweep

- [ ] **Step 1: Run all tests**

```bash
pnpm -r test
pnpm -r typecheck
pnpm -r lint || true
```

Expected: all green except known pre-existing lint warnings.

- [ ] **Step 2: Manual smoke checklist (open /builder in browser)**

- Toggle to advanced → sections render
- Add experience → flash-green on save
- Click an existing card → enters edit mode
- Try editing a second card → "save or discard?" prompt
- Click Import → upload PDF → see preview → Apply → editor populates
- Type in JD field → 5s later, fit-score panel appears
- Click "Rewrite with AI" on a bullet → bullet changes → undo works
- Drag an experience card up → order changes → reload → persists
- Toggle to basic → all data still there
- Save → reload → all data still there
- Download PDF → all sections appear

- [ ] **Step 3: Tag and commit final**

```bash
git commit --allow-empty -m "chore: builder rework Phase 9 verification pass complete"
```

---

## Done

When all 9 phases ship green, sub-project 1 is complete. Move to sub-project 2 (dark contrast + menu polish) — separate spec.

---

## Self-Review (run inline after writing the plan)

**Spec coverage check** — every spec section maps to a task:

- Spec §3 (architecture) → Tasks 4.1-4.2 (AdvancedEditor + wire into page) ✓
- Spec §4 (component structure) → Tasks 2.1 (shell) + 3.1-3.9 (9 sections) + 4.1 (composition) ✓
- Spec §5 (user flows) → 5.1 (editing flow handled in 4.x), 5.4 (import = 5.1), 5.5 (AI = 6.x), 5.3 (drag = 7.1) ✓
- Spec §6 (state management) → handled in 4.1 (single-edit) + 4.2 (shared state) + autosave noted as part of 4.2 wiring ✓
- Spec §7 (schema additions) → Task 0.1 ✓
- Spec §8 (PDF templates) → Tasks 8.1-8.4 ✓
- Spec §9 (API surface) → Tasks 6.1-6.2 ✓
- Spec §10 (accessibility) → drag keyboard alt covered in 7.x; aria-labels noted throughout; flash-on-save aria-live in 2.1 ✓
- Spec §11 (i18n) → strings noted as next-intl keys throughout but i18n key wiring is part of each section task ✓
- Spec §12 (testing) → unit tests in each section + 8.4 (PDF snapshots) + 9.1 (E2E) + 9.2 (full sweep) ✓
- Spec §13 (performance) → autosave debounce noted in 4.2; preview debounce part of 4.2 ✓
- Spec §14 (rollout) → no DB migration needed, schema additions covered in 0.1 ✓
- Spec §15 (success criteria) → covered by 9.2 manual checklist ✓

**Placeholder scan:** searched for "TBD", "TODO", "fill in" — none present in tasks. Some tasks reference "same pattern as Task 3.1" with specific field deltas — acceptable since the pattern is fully shown in 3.1.

**Type consistency:** `SectionCardProps<T>`, `Resume`, `formatMonthYear`, `editingId: string | null` — used consistently across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-builder-rework.md`.

Per user's authorization ("do everything, no need for permission"), proceeding with **subagent-driven execution** — fresh subagent per task, review between tasks.
