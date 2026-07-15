## Why

Production weekly-report and admin UI still type live data through mock modules, so mock and real shapes can drift without a compile error. P1-5 in `docs/reviews/2026-07-15-external-sweep.md` identifies the live consumers and dead mock values.

## What Changes

- Follow up `admin-presentation-type-ssot`: retain its three completed model import repoints and do not duplicate them.
- Retype weekly report, portfolio, accordion, print, and page-view consumers to canonical `Weekly*` types from `weekly-report-types.ts`; remove compatibility casts.
- Repoint remaining live admin presentation consumers to feature-owned types in `features/admin/model/admin-types.ts`, moving any residual presentation-only declarations there before deleting them from the mock module.
- Make retained fixtures satisfy the live feature types instead of defining their contract.
- Delete unreferenced `MOCK_*` values and mock-only lookup helpers after a repository-wide usage audit.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `web-model-type-boundary`: all live weekly-report and admin presentation consumers use canonical feature types; mock modules own fixtures only.

## Impact

- Web report-section, print, and admin feature types, imports, fixtures, and tests.
- No runtime data, API, schema, or route behavior changes.

## Non-goals

- Repeating `admin-presentation-type-ssot` changes in `group-form.ts`, `product-form.ts`, or `user-form.ts`.
- Renaming every established admin presentation type in the same slice.
- Deleting fixtures still used by tests or story-like development surfaces.
