## Why

WeeklyReport already supports the core weekly-report journey, but live source-bound checks exposed false history copy, a blank PDF popup, undersized mobile controls, and concurrency holes; repository audits also found required integration tests absent from CI, stale quality evidence, and contradictory operations guidance. Closing these proven gaps now gives the MVP one honest product-first acceptance path instead of another persistent browser, UAT, catalogue, or campaign harness.

## What Changes

- Make period creation/update, published-report deletion, carry-over, revoke, and period-module composition fail closed under concurrency and real Nest wiring.
- Correct compiled-history presentation, PDF delivery, and the lead's jargon-heavy end-of-form submission summary; bring the remaining mobile actions to the 44 px compact-viewport floor and close the six then-active mobile changes with one-off browser evidence.
- Add required disposable-database integration and explicit coverage CI lanes, including rollback proof and fail-closed Mailpit execution.
- Catalogue every tracked file once with role, owner, review lens, verdict, and evidence; remove proven dead repository material, reconcile docs/current quality denominators, and produce explicit dispositions for a separate semantic OpenSpec-retirement change.
- Repair repository-owned development, deployment, backup, hook, observability, and recovery documentation/configuration. External receivers, off-host storage, and platform controls remain honest external blockers rather than simulated PASS results.

### Non-goals

- No persistent E2E/UAT/browser/catalogue/campaign harness.
- No restoration of archived drivers or historical changes; archives remain provenance unless a current reference proves them dead.
- No implementation of unrelated deferred product features.

## Capabilities

### New Capabilities

- `report-delete-integrity`: Atomic lifecycle-guarded report deletion.
- `test-evidence-integrity`: Required integration and non-empty coverage proof in CI.
- `repository-file-accountability`: One-time complete tracked-file adjudication without a standing harness.
- `operations-local-readiness`: Internally consistent repo-owned runbooks, hooks, backups, Compose, and observability configuration.

### Modified Capabilities

- `period-scheduler-wiring`, `report-section-write-gates`: Explicit race-safe period and section-write requirements; existing dual-state and carry-over contracts remain unchanged and are implemented as written.
- `lead-history-summary`, `lead-completion-guidance`, `pdf-export-integrity`, `ui-control-density`: Correct product copy, submission guidance, download lifecycle, and compact control geometry.
- `dependency-currency`: Remove the obsolete Playwright-base-image sync contract and require explicit pnpm pins everywhere Node 26 executes.
- `uat-quality-gates`: Product-first exact-SHA acceptance without a persistent browser campaign.
- `destructive-db-guard`: Exact disposable-target safety contract with no broad suffix or production bypass.

## Impact

Touches API transactions and composition, web history/PDF/mobile UI, shared contracts, integration tests, CI, Compose/deploy/hooks, curated docs, quality evidence, and OpenSpec. Initial planning basis, not current-status evidence: 4,374 tracked files, 165 durable specs, six active mobile changes, and source-bound desktop/phone/tablet diagnostics on `835be43b6ccba71f151d52021c880a4930c2f69b`.
