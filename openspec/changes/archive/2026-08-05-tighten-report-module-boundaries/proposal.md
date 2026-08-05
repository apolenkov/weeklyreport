## Why

Report changes remain harder to review safely than they should be: two shared API projections bypass module ownership, while report-history state and presentation still live in the Next routing tree. The final repository-structure audit identified these as the two small, behavior-neutral boundary gaps that are ready to close before the SHA-bound runtime campaign; the larger print/PDF and package-export moves remain intentionally separate.

## What Changes

- Move the published-report snapshot and escalation projections under their owning API module and expose every cross-module consumer through its facade.
- Move report-history UI and client state from `app/(app)/reports/` into the established period feature, leaving route files as composition only.
- Remove the matching API boundary exceptions and ratchet the resulting web feature boundary.
- Preserve routes, tRPC contracts, rendered behavior, persistence semantics, and period/submission invariants.

### Non-goals

- No product behavior, schema, migration, role, or API-contract change.
- No relocation of the path-sensitive print/PDF subtree.
- No tightening of `packages/ui` wildcard exports.
- No aesthetic subdivision of the runtime-sweep, scripts, or Prisma trees.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `directory-architecture-standard`: Make publication-owned projections and report-history feature placement explicit, and require their former boundary exceptions to be removed.

## Impact

- API: `apps/api/src/modules/{publication,archive,pdf-export,period,weekly-report}` and the cross-module boundary configuration/tests.
- Web: `apps/web/src/app/(app)/reports/`, `apps/web/src/features/period/`, route-relative tests/imports, and the web-slice boundary inventory.
- Verification: focused unit tests, strict ESLint, TypeScript, integration coverage for projection consumers, and unchanged runtime/catalog routes.
