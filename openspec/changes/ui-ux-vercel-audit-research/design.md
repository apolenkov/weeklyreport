# Audit Memo — UI/UX, Next.js 16 / Vercel, Core Web Vitals

> Status: RESEARCH-ONLY. This memo records observations and recommendations.
> It mandates no implementation. Per CLAUDE.md ("Visual And Theme Work") and the
> locked decisions (2026-05-29), dark mode, background/theme, font, and
> slide-layout work are deferred pending explicit direction. No measurements
> were run; no Lighthouse/CWV scores are reported as fact. Findings are derived
> from a static read of the codebase.

## Context

CustomReport's frontend is Next.js 16 (App Router) / React 19.2 with modern
patterns: all functional components, no `React.FC`, no `getStaticProps`, and
one intentional class component (`QueryErrorBoundary`). Data flows through the
tRPC client + TanStack Query; shared contracts live in `packages/shared`; UI
primitives are shadcn/ui in `packages/ui`. There are 151 web component files
and 70 web test files (Vitest + Testing Library), with Playwright e2e and
visual snapshots configured.

Several visual/UX items are already explicitly deferred via TODOs and the
research-only rule:

- `v8.4.3-slide-redesign` — "2-column grid breaks visual rhythm at breakpoint"
  in `apps/web/src/components/slides/`.
- VERCEL-FONT migration — font strategy change, deferred.
- UFB-074 — theme switch, research-only.
- `i18n-future` — production UI strings stay English; Russian only as
  data/comment/test.

This memo organizes the Wave-4 research lanes so a future implementation branch
has one coherent plan rather than scattered findings.

## Decision

Produce a four-lane audit memo and a single audit-discipline spec delta. Do not
implement any UI/UX/visual/Vercel/CWV change in this change. The spec delta
(`frontend-audit-memo`) records the discipline only: the memo must exist and
implementation must not proceed without explicit direction.

### Lane 1 — UI/UX consistency and information architecture

Observations (static, code-level):

- Role-scoped surfaces are well separated and tested
  (`apps/web/src/lib/role-visibility.test.ts`, the tRPC role-coverage test),
  which is a strength: the IA per role is enforced, not incidental.
- Slide rendering (`apps/web/src/components/slides/status-slide-deck.tsx`,
  `section-slide-utils.ts`) carries the known `v8.4.3-slide-redesign`
  breakpoint issue — the 2-column grid breaks visual rhythm at a breakpoint.
  This is the most concrete UX defect already acknowledged in code.
- Deferred-feature UX discipline is consistent: `ComingSoonBadge` /
  `TrafficLightBadge` and the nav-bar coming-soon controls communicate
  roadmapped-but-inert features cleanly.

Recommendations (for a later implementation branch, not now):

- Resolve the slide 2-column breakpoint as part of any slide redesign; treat it
  as the anchor UX item rather than a generic "polish" pass.
- Audit spacing/typographic rhythm holistically with the deferred font change,
  since font metrics and grid rhythm interact.

### Lane 2 — Accessibility (static review)

Observations:

- shadcn/ui primitives provide a reasonable a11y baseline (Radix under the
  hood: focus management, roles, keyboard handling in dialog/sheet/dropdown).
- Error boundaries exist (`error.tsx`, `global-error.tsx`, `QueryErrorBoundary`)
  — good for not stranding users on a blank/broken state.
- No automated accessibility scan was run in this change. The status-light /
  traffic-light UI (`TrafficLightBadge`) is a candidate contrast / non-color
  redundancy review item (color alone must not encode status).

Recommendations:

- Add an automated a11y pass (axe via Playwright) in the later implementation
  branch; do not treat this static read as a substitute.
- Verify focus order and visible focus on the report form, stage chips, and
  slides navigation specifically (the highest-interaction lead surfaces).
- Confirm status is conveyed by label/icon and not color alone in
  traffic-light components.

### Lane 3 — Next.js 16 / Vercel best practices

Observations (from `apps/web/next.config.ts`, `apps/web/src/app/`):

- App Router is in use with a clear `(app)`, `api`, `auth`, `print` segment
  layout; a dedicated `print/` route supports the PDF/export surface.
- Server/client boundaries: `login-page.client.tsx` is explicitly a client
  component; confirm during implementation that client components are minimized
  and data fetching favors server components / tRPC server context where it
  reduces client JS.
- Font strategy: VERCEL-FONT migration is deferred. The Next.js recommendation
  is `next/font` for self-hosted, layout-shift-free fonts — this should be the
  target of the deferred font work.
- Images: confirm `next/image` usage and `next.config.ts` image settings during
  implementation (static read only here).

Recommendations:

- When implementation is authorized: adopt `next/font` (ties into Lane 1
  rhythm), verify `next/image` for any raster assets, and audit caching /
  `revalidate` semantics for published-report read paths (read-heavy, viewer
  role).
- Keep the server/client split lean; treat large client components
  (`login-page.client.tsx`) as candidates to verify for unnecessary client JS.

### Lane 4 — Core Web Vitals (static observations + measurement plan)

Observations:

- Instrumentation already exists: `apps/web/src/lib/web-vitals.ts` and
  `apps/web/src/components/web-vitals-reporter.tsx`, wired in
  `apps/web/src/app/layout.tsx`. The `web-vitals` library is at 5.2.0
  (5.3.0 available). The plumbing to capture LCP/INP/CLS is therefore present.
- No CWV numbers are reported in this memo. Producing real figures requires
  running the app (dev/build + a measurement run), which is out of scope under
  the locked planning-only decision.

What to measure later (plan, not executed here):

- LCP: capture on the heaviest first-paint surfaces (lead report view, viewer
  published report); attribute to font/image/render-blocking resources.
- INP: capture on the highest-interaction surfaces (report form autosave, stage
  chips, slides navigation).
- CLS: capture around font swap (ties to the deferred font work) and the slide
  2-column breakpoint reflow.
- Wire the existing `web-vitals-reporter` output to an aggregation sink
  (or Vercel Analytics / Speed Insights) so the numbers are continuous, not a
  one-off snapshot.

## Alternatives considered

- **Implement fixes now (rejected).** Violates the research-only Wave-4 rule
  and the CLAUDE.md visual/theme prohibition. Visual/font/slide changes require
  explicit direction.
- **Run Lighthouse/CWV and report scores in this memo (rejected).** Requires
  running the app and a measurement pass, which the locked planning-only
  decision forbids. Reporting fabricated or one-off numbers would be misleading;
  a measurement plan is the honest deliverable.
- **No spec delta (rejected).** The repo is spec-driven; every change carries a
  delta. The delta here encodes audit discipline only (memo must exist,
  implementation deferred) and mandates no UI change, so it is compatible with
  the research-only rule.
- **Multiple per-lane changes (rejected).** Locked decision requires single-pass
  economy; one memo with four lanes is leaner and keeps the findings coherent.

## Deferral

Implementation is deferred pending explicit direction. No visual, theme,
background, font, slide-layout, Next.js/Vercel, or Core Web Vitals change is
made in this change. When direction is given, the later integration branch
should act on the prioritized recommendations above, guarding any HOT ZONE
(slide/report-period) work with existing green tests plus characterization
tests, per the locked decisions.
