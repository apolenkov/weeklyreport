# Phase 34, Plan 03 — SUMMARY

**REQ-IDs:** Q-03
**Commit:** `7818332 ci(34-03): mutation-audit + DOM-walker tools tracked + CI gate`
**Status:** complete

## What shipped

- `apps/web/uat-suite/mutation-audit.mjs` — repo-relative paths via `fileURLToPath`; allowlist file support; `--update-allowlist` flag; exits 1 on unexpected black holes.
- `apps/web/uat-suite/inventory.mjs` — same path-rewrite; outputs to `apps/web/uat-suite/inventory.{json,md}` instead of `.tmp/`.
- `apps/web/uat-suite/helpers.mjs` (new) — minimal companion (loginAs, waitForAppReady, emit, note) so inventory.mjs is self-contained without depending on the larger probe-helpers in `.tmp/`.
- `apps/web/uat-suite/mutation-audit.allowlist.json` — single entry: `carryOver.execute` (cron-only; user sees result as carry-over rows, no UI consumer expected).
- Root `package.json` scripts: `uat:audit`, `uat:audit:update`, `uat:inventory`.
- `.github/workflows/ci.yml` — new "Mutation Consumer Audit" step runs `pnpm uat:audit` after unit tests + coverage; `mutation-audit` report uploaded as 14-day artifact.

## Heuristic improvements over the .tmp/ version

- Same-namespace consumer match now also accepts `byPeriod` / `byId` / `pending` / `count` query prefixes (was only `list|get|snapshot|find|fetch`).
- First run after move shows: 21 VERIFIED / 4 PARTIAL / 1 BLACK HOLE (allowlisted). 0 unexpected — exit 0.

## Verification

- `pnpm uat:audit` runs clean locally (exit 0, allowlisted black hole only).
- `apps/web/uat-suite/mutation-audit.md` regenerated on every run; checked in or not — gitignored under `apps/web/uat-suite/` (only the .mjs scripts are tracked).

## Files

- `apps/web/uat-suite/mutation-audit.mjs`, `inventory.mjs`, `helpers.mjs`, `mutation-audit.allowlist.json` (new tracked dir)
- `package.json` (3 new scripts)
- `.github/workflows/ci.yml` (extended)

## Note on inventory.mjs

The runtime DOM walker stays manual (`pnpm uat:inventory`) because it needs the dev servers (`pnpm dev`) up. CI gate uses only the static mutation-audit. State-variant DOM coverage is a v8.1+ idea.
