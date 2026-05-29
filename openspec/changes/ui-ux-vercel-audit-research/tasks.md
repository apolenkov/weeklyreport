# Tasks

Gate after every step: `openspec validate ui-ux-vercel-audit-research --strict`.
(This is a research-only memo change. Per the locked decision 2026-05-29, no
`pnpm` install/typecheck/lint/test/build/format/migrate is run; the only
allowed command is `openspec validate`.)

## Memo: UI/UX and accessibility lane

- [x] Document UI/UX consistency and information-architecture observations
      across the four roles (lead, head, admin, viewer) in `design.md`.
- [x] Document static accessibility observations (semantics, focus order,
      contrast, aria usage) from a code-level read of `apps/web/src/components/`
      — no automated scanner is run.

## Memo: Next.js 16 / Vercel best-practices lane

- [x] Review `apps/web/next.config.ts` and App Router structure under
      `apps/web/src/app/`; record server/client boundary, font, image, and
      caching observations in `design.md`.
- [x] Record the deferred VERCEL-FONT migration and the
      `v8.4.3-slide-redesign` 2-column-grid breakpoint TODO as known, tracked
      items.

## Memo: Core Web Vitals lane

- [x] Document static CWV observations grounded in the existing instrumentation
      (`apps/web/src/lib/web-vitals.ts`,
      `apps/web/src/components/web-vitals-reporter.tsx`,
      `apps/web/src/app/layout.tsx`).
- [x] Write a "what to measure later" plan (LCP/INP/CLS capture method) — no
      measurement is run in this change; no fabricated scores are recorded.

## Memo: synthesis and deferral

- [x] Consolidate findings into a prioritized, repo-anchored recommendation
      list in `design.md`.
- [x] Record the explicit note: implementation deferred pending explicit
      direction. No visual/theme/background/slide-layout changes are made in
      this change (research-only per CLAUDE.md).
