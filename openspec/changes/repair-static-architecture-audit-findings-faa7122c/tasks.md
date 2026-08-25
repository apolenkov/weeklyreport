## 1. Runtime-sweep directory ownership

- [x] 1.1 Move the 14 direct `preflight-diagnostic-sidecar*` modules from `preflight/diagnostics/` to `preflight/diagnostics/sidecar/`, repair imports, and verify the old direct paths no longer exist.
- [x] 1.2 Move the 16 direct `preflight-reveal-continuation-*` launch modules from `preflight/launch/` to `preflight/launch/continuation/`, repair imports, and verify the old direct paths no longer exist.
- [x] 1.3 Move `asset-schemas`, `contract-factories`, `limits.test`, `limits`, `run-schemas`, `schema-primitives`, and `schemas` into `preflight/reveal/continuation/contracts/`, repair imports, and verify no copy or compatibility shim remains.
- [x] 1.4 Update runtime-sweep catalogue patterns for the canonical paths and verify `pnpm catalog:check` passes.
- [x] 1.5 Verify the moved test packet with `pnpm exec vitest run` over the moved diagnostic-sidecar, launch-continuation, and reveal-continuation contract tests, recording the exact file and case counts.
- [x] 1.6 Refresh `scripts/gates/directory-architecture/directory-architecture-baseline.json` only after the final tree is stable, then verify `pnpm lint:directory-architecture` passes with direct counts no greater than 30 and no new exception.

## 2. API section-write lifecycle gate

- [x] 2.1 Refine the `ReportSectionsRepository` section-keyed port to return `{ periodStatus, archived } | null`, update all port fixtures, and verify `pnpm --filter @customreport/api typecheck` passes.
- [x] 2.2 Update the Prisma repository lookup to select and return both lifecycle facts, and add a focused repository assertion proving the returned tuple.
- [x] 2.3 Apply the full non-archived `open`/`reopened` predicate in the `saveDraft` and `submitSection` application prechecks while preserving the locked transaction gate and existing error mapping.
- [x] 2.4 Add regressions proving `saveDraft` rejects archived-open and `submitSection` rejects archived-reopened before metadata lookup, validation, or mutation.
- [x] 2.5 Run `pnpm exec vitest run src/modules/report-sections/application/report-sections.service.test.ts src/modules/report-sections/application/report-sections.submit.test.ts src/modules/report-sections/infrastructure/report-sections.prisma-repository.test.ts` from `apps/api` and record the exact case count.

## 3. Durable specification reconciliation

- [x] 3.1 Sync the full section lifecycle precheck contract into `report-section-write-gates` and verify the archived-open/reopened scenarios are present.
- [x] 3.2 Sync the single outer Head toolbar Agent-review ownership into `deferred-feature-pattern` and verify the obsolete nested-slide ownership statement is absent.
- [x] 3.3 Remove the superseded Head-shell-in-`report-sections` requirement from `directory-architecture-standard`, retain `features/report-pages` as owner, and verify no contradictory requirement remains.
- [x] 3.4 Run `pnpm exec openspec validate --all --strict` and verify every active and durable specification passes.

## 4. Static close and independent acceptance

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm depcruise`, and `pnpm knip`; verify every command exits zero and retain the exact SHA/tree with the results.
- [x] 4.2 Inspect `git diff --check`, the complete scoped diff, changed-file inventory, and rename detection; verify no unrelated file, generated artifact, compatibility shim, or relaxed gate entered the change.
- [x] 4.3 Obtain Sol critical review of the final diff and evidence packet; close this change only on an explicit PASS with no unresolved material finding.
- [x] 4.4 Report browser, runtime, database, Redis, Docker, visual, release, and full CR-001 acceptance as `NOT-PROVEN` by this static change rather than treating static PASS as product completion.
