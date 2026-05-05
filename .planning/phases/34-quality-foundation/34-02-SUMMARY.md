# Phase 34, Plan 02 — SUMMARY

**REQ-IDs:** Q-02
**Commit:** `75e2f19 ci(34-02): vitest coverage thresholds + CI artifact upload`
**Status:** complete

## What shipped

- `apps/web/vitest.config.ts` — added `test.coverage` section: provider `v8`, reporters `text/lcov/html`, reportsDirectory `./coverage`, include `src/**/*.{ts,tsx}`, exclude RSC pages + `layout.tsx` shells + tests, thresholds 70/60/70/70.
- `apps/api/vitest.config.ts` (NEW file) — same shape, thresholds 80/70/80/80; excludes integration + eval specs from coverage so the metric reflects unit-test layer specifically.
- `.github/workflows/ci.yml` — Unit Tests step changed to `pnpm turbo test -- --coverage`; new "Upload coverage reports" step uploads `apps/{web,api}/coverage/` as `coverage-reports` artifact (14-day retention).

## Verification

- Both configs typecheck clean (vitest plugin diagnostic on plugin types is a pre-existing vite version mismatch in pnpm resolution; tsc excludes vitest configs).
- CI run produces a `coverage-reports` artifact downloadable from the workflow run.

## Files

- `apps/web/vitest.config.ts` (modified)
- `apps/api/vitest.config.ts` (new)
- `.github/workflows/ci.yml` (modified)
