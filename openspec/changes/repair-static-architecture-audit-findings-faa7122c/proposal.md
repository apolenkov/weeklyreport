## Why

The static quality close for source `faa7122c` passed 37 of 38 lint rows but found three runtime-sweep directories above the 30-file ownership limit, while manual review found that archived report sections are rejected only by the final transaction gate instead of the earlier application precheck. Two durable specifications also contradict the current, tested UI and feature-slice ownership.

The findings are grounded in `scripts/gates/directory-architecture/directory-architecture-baseline.json`, the three overflowing `e2e/runtime-sweep/preflight/**` directories, `apps/api/src/modules/report-sections/application/report-sections.service.ts`, and the existing `report-section-write-gates`, `deferred-feature-pattern`, and `directory-architecture-standard` specifications.

## What Changes

- Physically group runtime-sweep sidecar, launch-continuation, and continuation-contract modules so each direct directory returns below the existing limit without adding exceptions.
- Refresh the structural identity baseline and ownership catalogue only after the moves and import repair are complete.
- Make the report-section application precheck read both `periodStatus` and `archived`, rejecting archived writes before mutation while retaining the locked transaction gate.
- Reconcile the two contradictory durable requirements with the current tested Agent-review toolbar placement and `features/report-pages` shell ownership.
- Add focused regression tests and rerun the existing static gates.

### Non-goals

- No browser, runtime sweep, database, Redis, Docker, visual, release, or task-5.19 acceptance work.
- No new public facade, compatibility shim, directory exception, lint rule, or quality baseline relaxation.
- No change to report-section error codes/messages or transaction-level TOCTOU protection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-section-write-gates`: Require the application precheck to apply the full section-keyed period-status and archive predicate.
- `deferred-feature-pattern`: Align Agent-review ownership with the single outer Head report toolbar control in form and slides modes.
- `directory-architecture-standard`: Remove the superseded Head shell location requirement and preserve `features/report-pages` as the page-assembly owner.

## Impact

Affected areas are internal runtime-sweep module paths and catalogue identity, the report-sections repository port and Prisma adapter, three focused API test files, and the three named durable specs. There are no dependency, schema, route, credential, or external API changes.
