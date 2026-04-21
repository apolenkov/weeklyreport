# Technology Stack: v4.0 UI Redesign + E2E Testing + Backend Hardening

**Project:** CustomReport
**Milestone:** v4.0 Backend Completeness & UI Redesign
**Researched:** 2026-04-21
**Overall confidence:** HIGH (versions verified against installed package.json files)

---

## Scope

This document covers ONLY the new libraries, patterns, and integration concerns
for v4.0. It does NOT re-research the base stack from v1.0–v3.0 (NestJS 11,
Prisma 7, Zod 4, tRPC 11, BullMQ, Docker Compose, SAML auth, PgBouncer,
Next.js 16, shadcn/ui 4, Tailwind v4, Vitest 4, Playwright 1.55).

**v4.0 adds three capability areas:**

1. Professional dark-theme UI redesign (design tokens, animation, components)
2. Comprehensive Playwright E2E suite (full role journeys, cross-role lifecycle)
3. Prisma migration hardening (reminder schema, edge-case fixes)

---

## 1. UI Redesign

### What Is Already Installed

All core UI libraries are already present — no new packages needed for the redesign:

| Library | Installed Version | Location | Purpose |
|---------|-------------------|----------|---------|
| `next-themes` | 0.4.6 | `packages/ui` | Dark/light mode toggle |
| `sonner` | 2.0.7 | `packages/ui`, `apps/web` | Toast notifications |
| `tw-animate-css` | 1.4.0 | `packages/ui` | CSS-based Tailwind animations |
| `tailwindcss` | 4.2.2 | Both | Utility classes |
| `radix-ui` | 1.4.3 | `packages/ui` | Headless primitives |
| `lucide-react` | 0.500.0 | Both | Icon system |
| `class-variance-authority` | 0.7.1 | `packages/ui` | Component variants |
| `tailwind-merge` | 3.5.0 | `packages/ui` | Class deduplication |
| `geist` | 1.7.0 | `apps/web` | Primary typeface |

**Design token system is live:** `packages/ui/src/styles/globals.css` already
has a complete OKLCH-based dark palette (deep navy + bright indigo + amber
accents) in a Tailwind v4 `@theme` block. Colors cover background, foreground,
muted, accent, card, popover, primary, secondary, sidebar, border, ring, and
chart tokens.

**Custom animations are live:** `globals.css` already defines `animate-fade-in`,
`animate-slide-in-left`, `animate-scale-in`, and collapsible keyframes. Radix
data-state-driven transitions are in use in sheet and tooltip components.

### What Is Missing

**`next-themes` is imported in `packages/ui/src/components/ui/sonner.tsx` via
`useTheme` but `ThemeProvider` is NOT wired into `apps/web/src/app/layout.tsx`.**
The root layout renders without a `ThemeProvider`, so `useTheme()` will always
return `"system"` and theme switching will not work. This is a wiring gap, not
a package gap.

**No `motion` / `framer-motion` package is installed.** The project uses
Tailwind CSS animations and Radix data-state transitions for all current
animations. Do NOT add `motion` — the existing CSS-based approach is sufficient
for a corporate reporting tool with 6 users, and `motion` adds 30KB+ bundle
weight. If a specific interactive animation is needed later, use
`tw-animate-css` utilities or plain `@keyframes` in `globals.css`.

**No `recharts` or chart library is installed.** The design tokens define chart
colors (`--color-chart-1` through `--color-chart-5`) but no chart components
exist. The v4.0 milestone does not require charts (dashboard shows submission
status table, not graphs). Do NOT add a chart library unless the roadmap
explicitly calls for trend analytics.

### Prescriptive Recommendations

**Wire ThemeProvider:** Add `<ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>` to `apps/web/src/app/layout.tsx`. The HTML element already has `suppressHydrationWarning`. Set `defaultTheme="dark"` since the entire palette is dark-first.

**Extend design tokens in `globals.css`, not in component files.** Any new
surface (status badge, timeline, progress indicator) should add OKLCH tokens to
the `@theme` block and consume them via `var(--color-*)`. Never hardcode hex or
rgb values in component styles.

**Use `tw-animate-css` for page transitions.** Import `tw-animate-css` utilities
(`animate-in`, `fade-in-0`, `slide-in-from-top-4`, etc.) in component class
strings. Radix components already consume these via `data-[state=open]:animate-in`.

**What NOT to add:**
- `motion` / `framer-motion` — overkill, adds bundle weight, CSS animations are enough
- `@emotion/react` or any CSS-in-JS — incompatible with Tailwind v4 approach
- `react-spring` — same reason as motion
- Storybook — overkill for 6-user internal app with no design system consumers

---

## 2. E2E Testing (Playwright)

### What Is Already Installed and Wired

Playwright is fully operational at `@playwright/test` 1.55.0. The infrastructure
is complete:

| Pattern | Status | Where |
|---------|--------|-------|
| `storageState` per-role auth | Done | `e2e/auth.setup.ts` + `e2e/.auth/*.json` |
| Fixture-based role pages | Done | `e2e/fixtures.ts` (`leadPage`, `headPage`, `viewerPage`) |
| Visual regression screenshots | Done | `e2e/visual/screenshots.spec.ts` |
| Accessibility audits | Done | `e2e/a11y/accessibility.spec.ts` via `@axe-core/playwright` |
| Responsive breakpoint tests | Done | `e2e/responsive/breakpoints.spec.ts` |
| Per-role journey files | Done | `e2e/journeys/` (lead, head, admin, carry-over, pdf, archive) |
| `webServer` auto-start (API + web) | Done | `playwright.config.ts` |
| CI retries + `github` reporter | Done | `playwright.config.ts` |

### What Is Missing

**The existing journey tests are shallow.** They verify page load and heading
visibility, but do NOT exercise the actual user actions from the 81 regression
scenarios. The `head-publication.spec.ts` journey, for example, only checks that
the "Publish Report" button OR "Published" badge is visible — it never clicks
the button and verifies the state transition.

**No Page Object Model (POM).** All locators are inline in every test. When the
redesign changes element labels or ARIA roles, dozens of tests will break and
each one requires manual locator fixes. With POM, one file changes.

**Cross-role lifecycle scenario is absent.** No test exercises the complete flow:
Lead submits → Head reviews → Head publishes → Viewer sees the report. This is
the most critical regression scenario.

**No `helpers/` directory.** The `e2e/helpers/` directory listed in the folder
structure is empty. Common actions (fill a report section, add a risk, submit)
should be helpers consumed by journeys.

### Prescriptive Recommendations

**Add a Page Object layer at `e2e/pages/`.** Create one class per page with
typed locators and action methods. Example structure:

```typescript
// e2e/pages/lead-report.page.ts
export class LeadReportPage {
  constructor(private page: Page) {}
  readonly heading = this.page.getByRole('heading', { name: 'My Report', level: 1 });
  async goto() { await this.page.goto('/lead/report'); }
  async fillPriority(n: number, text: string) {
    await this.page.getByRole('textbox', { name: `Priority ${n}` }).fill(text);
  }
  async submit() {
    await this.page.getByRole('button', { name: 'Submit Section' }).click();
  }
}
```

**Add `e2e/helpers/actions.ts`** for composite multi-step actions that span
multiple pages (e.g., `completeLead1Section(page)`).

**Use `test.step()` for readability in long journeys.** This groups assertions in
Playwright's HTML report without nesting describe blocks.

**Use `expect.poll()` for async state transitions** (e.g., waiting for submit
status to change from draft to submitted after clicking Submit). Avoid
`waitForTimeout` entirely.

**The `reducedMotion: 'reduce'` setting is already set** in `playwright.config.ts`
`use` block — animations are suppressed globally for test stability. Do not
remove this.

**Do NOT add:**
- `playwright-testing-library` — `getByRole` already covers accessibility-first
  queries natively in Playwright 1.50+
- `@playwright/experimental-ct-react` — component tests belong in Vitest, not
  Playwright; Playwright is for full E2E only
- Cucumber/Gherkin BDD layer — unnecessary complexity for this team size

### No New Packages Required

All Playwright capabilities needed for v4.0 are in `@playwright/test` 1.55.0
and `@axe-core/playwright` 4.11.1 (already installed). The gap is patterns,
not packages.

---

## 3. Prisma Migration Hardening

### What Is Already Installed

Prisma 7.x is installed and operational. The `prisma migrate dev` workflow is
in use. No new packages are needed.

### What Is Missing

**The reminder schema migration has not been applied.** The v4.0 goal includes
a Prisma migration for `kind/fireAt/timezone/status/version` fields on the
Reminder model. This is a schema authoring and migration execution task, not a
library addition.

**No `prisma migrate diff` usage in CI.** Production deployments should use
`prisma migrate deploy` (not `dev`). Local development uses `migrate dev`. The
difference matters for safety: `migrate deploy` applies pending migrations
without generating new ones; it fails loudly if the schema drifts from migration
history.

### Prescriptive Recommendations

**Migration flow for reminder schema:**
1. Edit `prisma/schema.prisma` to add the new fields
2. Run `pnpm exec prisma migrate dev --name reminder-schema-v2` locally
3. Commit the generated migration SQL file
4. Run `pnpm exec prisma generate` to regenerate client types
5. Production: `pnpm exec prisma migrate deploy`

**Add `prisma migrate diff` as a CI check** to detect schema drift:
```bash
pnpm exec prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url $SHADOW_DATABASE_URL \
  --exit-code
```
Exit code 2 means drift exists — fail the build.

**Do NOT use `prisma db push` in production or CI.** It bypasses migration
history and cannot be rolled back. Use only for quick local prototyping.

### No New Packages Required

All Prisma CLI commands needed (`migrate dev`, `migrate deploy`, `migrate diff`,
`migrate resolve`, `generate`) are built into `@prisma/client` 7.x. Zero
new dependencies.

---

## Alternatives Considered and Rejected

| Category | Rejected | Why |
|----------|----------|-----|
| Animation | `motion` (framer-motion) | 30KB+ bundle, CSS animations already present and sufficient |
| Animation | `react-spring` | Same reason; overkill for internal tool |
| Charts | `recharts` | Not needed for v4.0 scope; chart tokens exist for future use |
| Charts | `chart.js` | Same reason |
| Storybook | `@storybook/nextjs` | Overkill for 6-user internal app with no external design system consumers |
| E2E framework | Cypress | Already on Playwright; switching costs >> benefits; Playwright has superior network interception |
| E2E BDD | Cucumber/Gherkin | Added complexity with no benefit for a 1-2 dev team |
| Component tests | `@playwright/experimental-ct-react` | Vitest + Testing Library already handles component testing |
| Theme | Manual CSS variables | `next-themes` already installed; just needs wiring |
| ORM migrations | `prisma db push` | Bypasses migration history; unsafe for production |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| UI redesign packages | HIGH | Verified against installed package.json files |
| ThemeProvider wiring gap | HIGH | Read layout.tsx and sonner.tsx directly |
| Animation approach | HIGH | Verified globals.css and tw-animate-css usage |
| Playwright patterns (POM, storageState) | HIGH | Verified existing fixtures.ts and config |
| Journey test gaps | HIGH | Read all journey spec files directly |
| Prisma migration commands | HIGH | Prisma 7 docs, built-in CLI |
| No new packages for E2E/Prisma | HIGH | Confirmed against installed deps |

---

## Sources

- Installed `packages/ui/package.json` (next-themes 0.4.6, sonner 2.0.7, tw-animate-css 1.4.0)
- Installed `apps/web/package.json` (@playwright/test 1.55.0, @axe-core/playwright 4.11.1)
- `packages/ui/src/styles/globals.css` — OKLCH design token system
- `apps/web/src/app/layout.tsx` — ThemeProvider wiring gap confirmed
- `apps/web/playwright.config.ts` — storageState, webServer, reducedMotion
- `apps/web/e2e/fixtures.ts` — role fixture pattern
- `apps/web/e2e/journeys/*.spec.ts` — shallow test coverage confirmed
- Playwright 1.50+ docs: native `getByRole`, `expect.poll`, `test.step`, `storageState`
- Prisma 7 docs: `migrate dev` vs `migrate deploy` vs `migrate diff`
