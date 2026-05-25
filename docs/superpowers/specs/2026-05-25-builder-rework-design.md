# Builder Rework — Design Spec

**Status:** Approved (2026-05-25)
**Scope:** Sub-project 1 of 3 (Builder rework). Sub-projects 2 (dark contrast + menu polish) and 3 (theme harmony sweep) will get their own specs once this lands.
**Reference codebase:** `/Volumes/Server_Data/code-server/workspace/job-app` — we are porting feature parity from its profile/CV builder.

## 1. Overview

### What we're building

Replace the current "Advanced mode is a placeholder card" state in the resume builder with a fully functional section-card editor that has feature parity with the sibling `job-app` codebase's profile UI — plus AI affordances (per-bullet rewrite, fit-score panel, skill autocomplete, summary rewrite).

### Why

Two reasons:

1. **Feature gap with job-app.** The Hebrew-first job-app has years of refinement on its profile/CV builder UX — MM/YYYY pickers, per-entry cards, ongoing toggles, comma-typed tech tags, two-step import-preview flow, flash-on-save. Resumaker's builder skipped most of this and ships with a free-text "paste a profile and let AI fill in" form. New users coming from job-app reasonably expect the same control.
2. **Latent bugs block a clean rework.** Even if we keep the current shape, four bugs make the builder unreliable: ImportProfileButton passes the wrong response shape (import always silently does nothing), PDF templates drop projects/awards/certifications (users edit them, see nothing in PDF), basic-mode hydration is lossy on re-edit, and two type definitions diverge from the canonical Zod schema. We fix these as part of the rework so the new code stands on a clean foundation.

### Out of scope

- Profile-as-source rearchitecture (job-app's pure model). Resumaker keeps the resume-as-document model; profile remains a separate import-helper page.
- New PDF templates. We update the three existing templates (modern/classic/minimal) to render new sections; we don't add a fourth.
- Cover letter regeneration UX changes. Cover letters stay where they are.
- Job-app's "Interview Prep" and "Follow-up Email" generators. Those are valuable but distinct features for a separate spec.
- A separate Profile page rework (we may touch it for bug fixes only).

## 2. Current State Context

### Existing builder (`apps/web/src/app/[locale]/(app)/builder/page.tsx`)

- **Basic mode:** paste-a-JD-and-fill-the-form layout. Single form with name/email/phone/location/linkedin/summary inputs, comma-separated skills string, free-text experience textarea (LLM extracts structure). Submit → `POST /api/resumes/generate` → preview pane shows result. Save → POST or PATCH to `/api/resumes`.
- **Advanced mode:** a styled placeholder card with a roadmap list and a "Use Basic mode" button. No functional editor.
- **Mode toggle:** persisted in URL as `?mode=advanced`.
- **MonthYearPicker** and **BuilderModeToggle** components exist and are complete; only the toggle is wired in.

### Existing schema (`packages/shared/src/schemas/index.ts`)

`ResumeSchema` already includes Projects and Awards (added in commit 8f4309e). All sections we need are present in some form. The schema needs four additive non-breaking changes (section 7 below).

### Latent bugs we fix as part of the rework

| Bug                             | Where                                                                                                                   | Fix                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Import does nothing             | `components/import-profile-button.tsx:45` — `onImport(data)` should be `onImport(data.profile)`                         | Pass the inner profile object                                           |
| PDF drops projects/awards/certs | `packages/resume-engine/src/templates/{modern,classic,minimal}.tsx`                                                     | Add render blocks                                                       |
| Basic-mode re-edit loses fields | `builder/page.tsx:126–166` — `useEffect` hydrates only name/email/summary/skills/industry/locale/templateId from `?id=` | Hydrate all contact fields + experience text from saved content         |
| Type subset divergence          | `builder/page.tsx:24–44` (`ResumeResult`) and `components/resume-preview.tsx`                                           | Replace local types with canonical `Resume` import; render all sections |

## 3. Architecture

### Hybrid: section-card editor for the current resume

We keep resumaker's resume-as-document architecture (each resume is a self-contained document). The advanced mode becomes a comprehensive editor for the **current** resume, mirroring job-app's profile UI pattern but bound to one resume rather than a shared profile.

Basic mode stays — it's the "magic onboarding" path for new users without a polished resume. Advanced is the power-user path.

### Two-pane layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Mode: Basic | Advanced]  [Import…]    [Save] [Export ▾]        │
├──────────────────────────────────────┬──────────────────────────┤
│  EDITOR (scrolls)                    │  LIVE PREVIEW (sticky)   │
│                                      │                          │
│  CONTACT — card                      │  ┌────────────────────┐  │
│  SUMMARY — card                      │  │ Rendered resume    │  │
│  EXPERIENCE (n) — cards + add        │  │                    │  │
│  EDUCATION (n) — cards + add         │  │ + Fit Score panel  │  │
│  PROJECTS (n) — cards + add          │  │   when JD present  │  │
│  SKILLS — chips + add                │  │                    │  │
│  CERTIFICATIONS (n) — cards + add    │  └────────────────────┘  │
│  AWARDS (n) — cards + add            │                          │
│  LANGUAGES — chips + add             │                          │
└──────────────────────────────────────┴──────────────────────────┘
                          Mobile: tabs to swap panes
```

- **Editor pane:** vertical stack of section components. Each section renders its own list of cards plus an "+ Add" button.
- **Preview pane:** sticky on desktop (≥ lg), uses an updated `ResumePreview` that renders ALL sections. Fit-score panel pinned above the preview when JD context is set.
- **Mobile:** the two panes become a tab pair (Editor | Preview). No split-screen on small viewports.

### Section order (fixed)

`Contact → Summary → Experience → Education → Projects → Skills → Certifications → Awards → Languages`

Within each multi-card section, entries can be drag-reordered. The default sort on first render is `start_date DESC` for date-bearing sections (Experience/Education/Projects/Certifications/Awards). User reorders persist in resume content (write to backend on drop).

## 4. Component Structure

### New files

| File                                                     | Purpose                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `components/builder/section-card.tsx`                    | Generic shell: read-only ↔ editing state machine, flash-on-save, hover affordances, delete confirmation    |
| `components/builder/sections/contact-card.tsx`           | Single-card section: name/email/phone/location/linkedin/github/website                                     |
| `components/builder/sections/summary-card.tsx`           | Single-card section: 4-row textarea + "Rewrite with AI" button                                             |
| `components/builder/sections/experience-section.tsx`     | List of experience cards + add form                                                                        |
| `components/builder/sections/education-section.tsx`      | List of education cards + add form                                                                         |
| `components/builder/sections/projects-section.tsx`       | List of project cards + add form                                                                           |
| `components/builder/sections/skills-section.tsx`         | Chip display + add form (no edit; delete chip with ×)                                                      |
| `components/builder/sections/certifications-section.tsx` | List of certification cards + add form                                                                     |
| `components/builder/sections/awards-section.tsx`         | List of award cards + add form                                                                             |
| `components/builder/sections/languages-section.tsx`      | Chip display + add form with level enum dropdown                                                           |
| `components/builder/import-modal.tsx`                    | Modal for the two-step import flow (upload → preview → apply)                                              |
| `components/builder/fit-score-panel.tsx`                 | Score card pinned above preview when JD present                                                            |
| `components/builder/ai-rewrite-button.tsx`               | Sparkle button next to bullets/summary, calls rewrite endpoint, 30s undo                                   |
| `components/builder/advanced-editor.tsx`                 | Top-level component that composes all sections; what `builder/page.tsx` renders when `mode === 'advanced'` |
| `app/api/resume/bullet/rewrite/route.ts`                 | Single-bullet AI rewrite endpoint                                                                          |
| `app/api/resume/fit-score/route.ts`                      | Fit-score endpoint (renamed/refactored from existing score)                                                |

### Modified files

| File                                               | Change                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/[locale]/(app)/builder/page.tsx`              | Wire `<AdvancedEditor>` in place of placeholder; share resume content state with both modes |
| `components/import-profile-button.tsx`             | Fix the `data.profile` bug                                                                  |
| `components/resume-preview.tsx`                    | Render ALL sections (currently misses languages/certifications/projects/awards)             |
| `packages/shared/src/schemas/index.ts`             | Schema additions per section 7                                                              |
| `packages/resume-engine/src/templates/modern.tsx`  | Add Projects, Awards, Certifications render blocks                                          |
| `packages/resume-engine/src/templates/classic.tsx` | Same                                                                                        |
| `packages/resume-engine/src/templates/minimal.tsx` | Same                                                                                        |
| `app/api/resumes/generate/route.ts`                | Ensure new fields (is_current, is_ongoing, credential_url) round-trip in AI response        |
| `app/api/profile/import/route.ts`                  | Confirm response shape matches what import-modal expects                                    |

### Component contract: `<SectionCard>`

```tsx
type SectionCardProps<T> = {
  data: T; // the entry being shown/edited
  isEditing: boolean;
  onEnterEdit: () => void;
  onSave: (next: T) => void; // called when user clicks Save in edit mode
  onCancel: () => void;
  onDelete: () => void;
  renderRead: (data: T) => ReactNode; // read-only display
  renderEdit: (data: T, onChange: (next: T) => void) => ReactNode; // form
};
```

The shell handles: flash-on-save animation, edit/delete hover icons, delete-confirm modal, focus management on enter-edit, click-outside-to-cancel guard. Each section provides its own render functions for read vs edit.

## 5. User Flows

### 5.1 Editing flow (the core loop)

1. User lands on `/builder` → defaults to basic mode (or whatever `?mode=` says + `?id=` to load).
2. User clicks `BuilderModeToggle` → advanced. URL updates to `?mode=advanced`.
3. AdvancedEditor mounts. Loads resume content from existing builder state (no separate fetch — basic and advanced share the same in-memory resume content).
4. User clicks an Experience card → it expands inline to edit form. (Single-edit rule: if another card was being edited, prompt to save/discard.)
5. User edits, clicks Save → validates via Zod sub-schema, updates in-memory content, fires debounced autosave (3s) to `PATCH /api/resumes/[id]`, flashes green border for 1800ms.
6. Live preview pane re-renders immediately (no debounce — local state).
7. If JD is set in basic mode (carried over), fit-score panel updates 5s after last edit.

### 5.2 Adding new entries

- "+ Add" button at section footer inserts a new card in editing state at the **top** of the list.
- Cancel before first save → removes the card (no orphan).
- Save → flash green, sort into position by date if applicable.

### 5.3 Drag-to-reorder

- Drag handle (`≡`) on the left of each card. Implementation: `@dnd-kit/sortable`.
- Drop → updates content order, fires autosave, fires preview re-render.
- Keyboard alternative: handle has `tabIndex={0}`, Space-then-arrow keys to reorder (dnd-kit built-in).

### 5.4 Import flow (modal)

1. Click "Import…" in header → opens `<ImportModal>`.
2. Step 1 — Upload: drag-drop zone or file picker. Accept `.pdf` and `.txt`. Max 10MB.
3. Step 2 — Parsing: shows pulsing sparkle + "Claude is reading your resume…". Calls `POST /api/profile/import` (existing endpoint).
4. Step 3 — Preview: shows a checklist of what was parsed (counts per section, sample names). User can untick sections to skip. Buttons: Apply / Discard / Try another file.
5. Step 4 — Apply: writes parsed content into in-memory resume content with these per-section rules:
   - **Contact fields** (name, email, phone, location, linkedin, github, website): OVERWRITE per-field only if parsed value is non-empty (don't blow away a manually-entered field with a blank one).
   - **Summary**: OVERWRITE only if parsed value is non-empty.
   - **Experience / Education / Projects / Certifications / Awards**: REPLACE the entire list **only if the parsed list is non-empty**. If parser returned `[]` (parser didn't find any), preserve existing entries — never silently delete the user's data because the parser came up empty.
   - **Skills**: MERGE (dedup by lowercased name; preserve all existing skills, add any new ones from parser).
   - **Languages**: same MERGE rule as Skills.
6. Modal closes. Flash all updated section headers green for 1800ms.

### 5.5 AI rewrite flows (Pro Max)

- **Per-bullet rewrite:** sparkle button next to each highlight in editing form. Click → `POST /api/resume/bullet/rewrite { bullet, jobDescription, tone }`. Loading spinner inline. Replaces with response + shows undo toast for 30s.
- **Summary rewrite:** "Rewrite for this JD" button in Summary card edit form (only enabled when JD context is present). Same API pattern.
- **Skill autocomplete:** as user types in skill input, show dropdown sourced from a bundled `common-skills.json` (top 200) + user's existing skills + skills extracted from current JD via simple regex match.
- **Fit-score panel:** when JD is present, panel above preview shows score 1–10 with color (green ≥7, yellow 5–6, red <5), missing keywords (red chips), strengths (green chips). Updates on 5s-idle debounce after edits. Cached server-side by `hash(resumeContent + JD)`.

## 6. State Management

### Single in-memory resume content

`builder/page.tsx` holds the resume content as a single `useState<ResumeContent>` (typed as canonical `Resume` from shared schema). Both basic mode (which compiles its form fields into this shape on submit) and advanced mode (which edits it directly) read and write the same state.

This means switching modes preserves all data. It also means basic-mode hydration just sets this state correctly — no separate form hydration needed.

### Autosave

- **localStorage** mirror: every state change writes to `localStorage[`resume-draft-${id ?? 'new'}`]` synchronously. On page load, if a draft exists and is newer than the saved version, prompt user to recover.
- **API autosave**: debounced 3000ms. Calls `PATCH /api/resumes/[id]` (only if `id` exists — for new unsaved resumes, requires Save click).
- **Save button**: forces immediate save, flushing any pending debounce. Required for new resumes that have no id yet.

### Single-edit rule

A single `editingCardId: string | null` state in `<AdvancedEditor>`. Section cards consult this to decide whether to render in read or edit mode. Clicking an edit on a different card while one is editing triggers a "Save or discard?" prompt.

### Flash-on-save

Section card maintains a `justSaved: boolean` ref that flips true for 1800ms after Save. CSS transition (`transition-colors duration-700`) handles the fade.

## 7. Schema Additions

All non-breaking (new fields optional, existing fields unchanged).

```ts
// packages/shared/src/schemas/index.ts

// ExperienceSchema — new field
is_current: z.boolean().optional().default(false),

// EducationSchema — new field
is_current: z.boolean().optional().default(false),  // "currently studying"

// ProjectSchema — new field
is_ongoing: z.boolean().optional().default(false),

// In ResumeSchema, certifications item — new field
credential_url: z.string().url().max(500).optional(),

// Languages — tighten level from free string to enum
// Existing field is already optional, so this is non-breaking IF we migrate existing values.
// We do migrate: on read, normalize any non-enum string to 'professional' as default.
languages: z.array(z.object({
  name: z.string().min(1).max(50),
  level: z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']),
})).max(10).optional()
```

### Migration of existing language data

Existing resumes may have `languages[].level` as arbitrary strings ("Advanced", "B2", etc.). We do NOT run a DB migration. Instead, on read in any component that displays languages, we pass through a `normalizeLevel(raw: string)` helper that maps common values and defaults to `'professional'` for unknown. This keeps existing resumes valid without write-time changes.

## 8. PDF Template Updates

Each template (`modern`, `classic`, `minimal`) gets render blocks for the missing sections. Visual treatment varies per template (each keeps its existing personality):

### Modern

- Projects: brand-accent left bar, name + dates row, URL as small link, tech tags as filled pills, description below
- Awards: same accent treatment, title + issuer + date in header row, description below
- Certifications: name + issuer + date, credential URL as monospace small link

### Classic

- Projects: italic subtitle for tech list, centered date range, plain description
- Awards: simple centered title + issuer line
- Certifications: name (bold) + issuer (italic) + date

### Minimal

- Projects: weight-only differentiation, generous whitespace, tech tags as plain comma-separated text
- Awards: title + issuer on one line, date right-aligned
- Certifications: name + date inline, credential URL as small grey

### Render order within PDF

For all three templates: `Header → Summary → Experience → Education → Projects → Skills → Certifications → Awards → Languages` — same order as the editor section list so what-you-edit visually maps to what-you-export. Empty sections (length 0) are skipped (no empty headers).

### Languages

Footer area in all three templates: small grey row showing `Hebrew (native) · English (fluent) · Spanish (basic)`. Matches resume-preview HTML pattern.

## 9. API Surface

### Existing routes — kept as-is

- `GET/POST /api/resumes`
- `GET/PATCH/DELETE /api/resumes/[id]`
- `POST /api/resumes/generate`
- `POST /api/resumes/score` (kept — ATS-style scoring used by basic mode's ATSScoreCard)
- `GET /api/resumes/[id]/pdf`
- `GET /api/resumes/[id]/export`
- `POST /api/profile/import`

### New routes

These are complementary to the existing `/api/resumes/score`, not replacements. `/score` returns an ATS-style breakdown (overall %, matched/missing keywords, formatting suggestions); `/fit-score` returns a job-fit summary (1–10 score, missing as gaps, strengths, rationale) — different shapes for different UI panels.

**`POST /api/resumes/bullet/rewrite`**

- Auth: session required
- Rate limit: 30 / hour (Plus + Pro), 10 / hour (Free)
- Body: `{ bullet: string (max 500), jobDescription?: string (max 20000), tone?: 'impact'|'concise'|'formal' (default 'impact') }`
- Response: `{ bullet: string }` — the rewritten version
- Model: Claude Haiku 4.5 (fast, cheap)
- Cached: by `hash(bullet + jd + tone)`, 7-day TTL

**`POST /api/resumes/fit-score`**

- Auth: session required
- Body: `{ resume: ResumeContent, jobDescription: string }`
- Response: `{ score: 1-10, missing_keywords: string[], strengths: string[], rationale: string }`
- Model: Claude Haiku 4.5
- Cached: by `hash(resumeContent + jd)`, 30-day TTL

## 10. Accessibility

- All form fields have visible `<label>` elements (not just placeholders).
- Section "+ Add" buttons have descriptive aria-labels (`aria-label="Add experience"`).
- Drag handles are keyboard-operable via `@dnd-kit/sortable`'s built-in keyboard sensor (Space to grab, arrows to move, Space to drop).
- Flash-on-save announces "Saved" via `aria-live="polite"` region so screen readers hear the confirmation.
- Color is never the sole signal — green flash also includes a checkmark icon briefly visible during the animation.
- Focus management: entering edit mode focuses the first input; saving returns focus to the card (so Tab works predictably).
- Editing form modals (delete confirm) trap focus and restore on close.
- All interactive elements are reachable via keyboard with visible focus rings (use existing `focus:ring-2 focus:ring-brand-500` pattern).

## 11. Internationalization

- All user-facing strings go through `next-intl` translation keys under `builder.advanced.*`.
- Hebrew RTL: section cards are bidirectional safe. Date pickers respect locale (Hebrew shows "מאי 2024" instead of "May 2024" via `Intl.DateTimeFormat`).
- "+ Add" button label translates (Hebrew: "הוסף", English: "+ Add").
- Section titles use existing `builder.sections.*` keys where they exist; new ones added.

## 12. Testing

### Unit tests (Vitest)

- `section-card.test.tsx`: state machine transitions, flash-on-save timing, single-edit rule
- Each section component: add → edit → cancel → save → delete flows
- `import-modal.test.tsx`: state transitions through Upload → Parsing → Preview → Apply
- `month-year-picker.test.tsx`: already tested, verify still passing
- `normalize-language-level.test.ts`: maps common strings, defaults unknown to 'professional'

### Integration tests

- `api/resume/bullet/rewrite/route.test.ts`: rate limit, validation, response shape
- `api/resume/fit-score/route.test.ts`: caching, response shape, JD length validation
- Old `api/resumes/score/route.test.ts`: still passes via compat shim

### E2E (Playwright)

Extend the existing builder smoke test:

- Switch to advanced mode → add experience → save → reload → see it
- Import sample PDF → preview shows correct counts → apply → all sections populated
- Drag experience cards to reorder → reload → order persists

### PDF snapshots

For each template (modern/classic/minimal), render a "kitchen sink" resume with all section types populated. Snapshot the PDF. CI flags any visual regression.

## 13. Performance

- **First paint:** advanced editor should render in <200ms after mode toggle. Achieved via local state (no fetch), code-splitting section components if bundle grows >50KB.
- **Edit responsiveness:** input lag <16ms (60fps). Achieved via uncontrolled inputs inside cards, only lifting state on Save.
- **Autosave debounce:** 3000ms to avoid hammering the API on rapid edits.
- **Preview re-render:** debounced 100ms (separate from autosave) — keeps preview snappy without thrashing on every keystroke.
- **PDF cache:** existing in-memory LRU at `apps/web/src/lib/pdf-cache.ts` handles this — no changes needed.

## 14. Rollout & Risk

### Rollout

- Schema changes are non-breaking (additive optional fields). No DB migration.
- Existing resumes load fine — new fields default to `false` / `undefined`.
- Old basic mode UI stays as the default. Users see the rework when they toggle to Advanced.
- After this lands, sub-project 2 (dark contrast + menu polish) gets specced and shipped.

### Risk: AI rewrite cost

Per-bullet rewrites could be triggered hundreds of times during heavy editing. Mitigations:

- Rate limit 10/hr Free, 30/hr Pro.
- Server-side caching by content hash (7-day TTL) means repeat clicks on the same bullet+JD don't re-bill.
- Visible counter in UI showing remaining rewrites this hour.

### Risk: Drag-to-reorder accessibility

`@dnd-kit` is well-tested but drag UX is notoriously hard for keyboard/screen-reader users. Mitigation: include explicit "Move up / Move down" menu items in each card's overflow menu as a secondary path. Drag is the visual primary; menu is the universal fallback.

### Risk: Type unification breaking existing screens

Replacing local `ResumeResult` and `ResumePreview` types with the canonical `Resume` import may surface latent type errors in code that consumed the old narrower shapes. Mitigation: TypeScript will tell us; we fix call sites as compile errors surface during implementation.

## 15. Success Criteria

This rework is done when all of these are true:

1. **Feature parity with job-app's profile UI** for: section cards, MonthYearPicker, is_current/is_ongoing toggles, Projects with tech tags, Skills with categories, Certifications with credential URL, two-step import flow.
2. **All four blocker bugs fixed and have regression tests.**
3. **PDF templates render every section** in the schema (projects, awards, certifications, languages now visible in exports for all 3 templates).
4. **AI affordances ship:** per-bullet rewrite, summary rewrite, fit-score panel, skill autocomplete.
5. **Drag-to-reorder works** with mouse, keyboard, and screen reader (verified with NVDA or VoiceOver).
6. **No regression in basic mode** — existing E2E test still passes.
7. **`pnpm -r test` and `pnpm -r typecheck` both green.**

## 16. Open Questions (resolved at design time)

None outstanding. Anything ambiguous in this spec defers to job-app's behavior at `/Volumes/Server_Data/code-server/workspace/job-app/frontend/app/(dashboard)/profile/page.tsx`.

---

**Next step:** writing-plans skill will turn this into a per-phase implementation plan with concrete file/function ordering.
