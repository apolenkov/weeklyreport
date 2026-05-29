# UI/UX + Vercel + Core Web Vitals Audit (Research-Only)

## Why

Wave 4 of the deferred quality program covers UI/UX, accessibility, Next.js 16 /
Vercel best practices, and Core Web Vitals. Per the repo's research-only rule,
visual/theme/background work and slide-layout polish must NOT be implemented
without explicit direction (see CLAUDE.md "Visual And Theme Work" and the
`v8.4.3-slide-redesign` / VERCEL-FONT TODOs). What is missing is a single,
grounded audit memo that catalogs the observations and recommendations so a
future implementation branch can act on a coherent plan instead of ad-hoc
findings.

This change produces that memo. It writes nothing executable: no source, no
config, no package.json, no lockfile, no install/format/migrate runs. The only
command in scope is `openspec validate`.

## What Changes

- Author an audit memo in `design.md` covering four research lanes:
  - UI/UX consistency and information architecture across the four roles
    (lead, head, admin, viewer).
  - Accessibility (semantics, focus, contrast, aria usage) as a static
    code-level review, not an automated scan.
  - Next.js 16 / Vercel best practices (App Router usage, server/client
    component boundaries, font strategy, image handling, caching).
  - Core Web Vitals as static observations plus a "what to measure later"
    plan, anchored to the existing `web-vitals` instrumentation
    (`apps/web/src/lib/web-vitals.ts`,
    `apps/web/src/components/web-vitals-reporter.tsx`,
    `apps/web/src/app/layout.tsx`).
- Record concrete, repo-anchored observations referencing known TODOs
  (`v8.4.3-slide-redesign` 2-column-grid breakpoint, deferred VERCEL-FONT
  migration, slide-deck rendering in `apps/web/src/components/slides/`).
- Add a single audit-discipline spec delta (the `frontend-audit-memo`
  capability) that requires the memo to exist and forbids implementation
  without explicit direction.

This change adds NO code tasks, NO visual/theme implementation, and NO spec
deltas that mandate any UI change.

## Impact

- Affected packages/files: documentation only, under
  `openspec/changes/ui-ux-vercel-audit-research/`. No runtime code touched.
- Surfaces referenced (read-only) for grounding: `apps/web/src/app/`,
  `apps/web/src/components/slides/`, `apps/web/next.config.ts`,
  `apps/web/src/lib/web-vitals.ts`,
  `apps/web/src/components/web-vitals-reporter.tsx`.
- Risk: none to runtime. The risk this change mitigates is uncoordinated visual
  work landing without a shared plan and in violation of the research-only rule.
- Honors locked decisions (2026-05-29): planning-only, single-pass, Wave 4 is
  research-only, no dark-mode/theme/background implementation.
