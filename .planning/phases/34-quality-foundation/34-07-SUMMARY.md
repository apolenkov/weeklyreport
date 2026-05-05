# Phase 34, Plan 07 — SUMMARY

**REQ-IDs:** Q-07
**Commit:** `3117844 ci(34-07): push-guard helper + Playwright flaky-rate metric + CONTRIBUTING`
**Status:** complete

## What shipped

### push-guard helper
- `scripts/push-guard.sh` (executable). Resolves origin's host, probes DNS via getent/host/dscacheutil, re-runs `git push` with `{http,https}_proxy` unset on failure. `--check-only` flag exits 0/1 without pushing. `--quiet` suppresses info logging.
- Recommended alias documented: `alias gpush='scripts/push-guard.sh'`.

### Flaky-rate metric
- `apps/web/playwright.config.ts` now uses `[['github'], ['json', { outputFile: 'e2e/.results/results.json' }]]` reporter in CI (was `github` only; local stays `html`).
- `scripts/flaky-rate.mjs` walks Playwright JSON, computes per-spec `passed-on-retry / total` (Playwright's `flaky` semantics: result.length > 1 && lastStatus === 'passed').
- Outputs `apps/web/e2e/.results/flaky-rate.{md,json}`.
- New CI step "Compute flaky-rate metric" runs after Playwright; "Upload flaky-rate metric" uploads the artifacts (30-day retention).

### CONTRIBUTING.md
- New file at repo root. Sections: Setup, Commit conventions (Conventional Commits + type-enum), Local quality gate (husky hooks + bypass), Pushing to origin/main (push-guard), Mutation Consumer Audit (allowlist workflow), Common gotchas.

## Verification

- `scripts/push-guard.sh --check-only` returns 0 on-VPN.
- Playwright JSON reporter doesn't break local `pnpm test:e2e` (CI-only via env check).
- `flaky-rate.mjs` handles missing JSON gracefully (no-op exit 0 with skip log).

## Files

- `scripts/push-guard.sh`, `scripts/flaky-rate.mjs` (new, both executable)
- `apps/web/playwright.config.ts` (reporter conditional)
- `.github/workflows/ci.yml` (2 new steps after Upload test results)
- `CONTRIBUTING.md` (new)
