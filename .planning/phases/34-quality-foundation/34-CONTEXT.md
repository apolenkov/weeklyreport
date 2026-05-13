# Phase 34: Quality Foundation — Context

**Gathered:** 2026-05-05 (post-hoc; plans 34-01..04 + 34-07 already shipped via overnight autonomous run)
**Status:** Ready for planning (residual: 34-05 TS rollup + 34-06 ESLint sweep)
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Codify a regression floor for the project: local pre-commit gate, CI coverage thresholds + audit gates, ESLint warning floor at zero, zero TypeScript errors, push-guard helper for the corporate-VPN scenario.

Slurps v7.0 Phase 33 (API Hardening: ESLint sweep, TS error rollup, Prisma migrate-reset gate, push-guard, flaky-rate metric).

In scope: husky + lint-staged + commitlint, vitest coverage thresholds with CI artifact upload, mutation-audit CI gate (`pnpm uat:audit`), Prisma migrate-reset CI gate, ESLint sweep (~272 → 0), TypeScript residual error cleanup, push-guard CLI + Playwright flaky-rate metric.

Out of scope: visual regression baseline (Phase 35), audit-trail extension (Phase 36-02), OTel/Prom (Phase 37).
</domain>

<decisions>
## Implementation Decisions

- **Hooks bypass policy:** `git commit --no-verify` and `SKIP_PREPUSH=1 git push` are documented escape hatches in CONTRIBUTING.md. Until 34-06 closes the warning floor, normal commits will fail unless they touch only files with no existing warnings.
- **Conventional Commits:** type-enum locked to {feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert}. Subject ≤100 chars. Body unrestricted.
- **Coverage thresholds calibrated to existing suite:** web 70% statements / 60% branches; api 80% / 70% functions/lines. Excludes RSC pages (driven by E2E) + integration/eval test specs.
- **DOM-walker tools:** moved out of `.tmp/` into tracked `apps/web/uat-suite/`. CI gate runs only the static `mutation-audit.mjs`; the runtime `inventory.mjs` stays manual (needs dev servers).
- **Mutation-audit allowlist:** `carryOver.execute` is the only intentional black hole (cron-only). New black holes require a justification entry in `apps/web/uat-suite/mutation-audit.allowlist.json`.

</decisions>

<code_context>

## Existing Code Insights

- `.github/workflows/ci.yml` already runs lint+typecheck+unit+E2E+Docker build before this phase. Phase 34 extends with coverage flag, mutation-audit step, migrate-reset job.
- `apps/web/vitest.config.ts` exists; `apps/api/vitest.config.ts` was created by 34-02 (no prior file).
- `apps/api/scripts/` directory was created by 34-07 (push-guard helper + migrate.sh).

</code_context>

<specifics>
## Specific Ideas

- 34-01: husky `prepare` script auto-installs hooks on `pnpm install`.
- 34-03: tools moved with full path-rewrite to use `fileURLToPath(import.meta.url)` for repo-relative IO.
- 34-07: Playwright config gains `--reporter=github,json` in CI; `scripts/flaky-rate.mjs` parses results.json into per-spec metric.
- 34-05/06 (residual): need careful per-file approach because mass changes risk merge conflicts. Best run as one focused session with `expectDefined()` test helper.

</specifics>

<deferred>
## Deferred Ideas

- Branch protection / required checks docs — out of scope (org-level GitHub config, not repo content).
- Coverage badges in README — nice-to-have, not blocking.

</deferred>
