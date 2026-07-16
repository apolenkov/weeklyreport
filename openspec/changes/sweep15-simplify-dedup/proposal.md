## Why

The API and web retain pass-through facades, optional production ports with silent fallbacks, repeated status ranking, duplicate date wrappers, bespoke confirmation dialogs, and divergent relative-time formatters. These P2 findings add indirection while allowing behavior to drift.

## What Changes

- Remove `AdminService`; expose and inject its focused sub-services directly in routers, schedulers, bootstrap, and other consumers.
- Make every production `AdminRepository` method required; use `unusedAdminRepositoryStubs()` explicitly in test doubles instead of service fallbacks.
- Add one `worstTrafficStatus` helper for residual rank copies not owned by `sweep15-status-derivation-ssot`, and reroute those consumers.
- Delete pass-through date wrappers and import canonical functions from `lib/format-date` at call sites.
- Replace fill-from and period-delete bespoke dialogs with `ConfirmationDialog`.
- Add `formatRelativePast(date, now, variant?)` to `lib/format-date` and migrate the three relative-past formatters without accidental copy changes.

## Capabilities

### New Capabilities

- `application-simplification`: Required ports, direct focused services, and canonical status/date/dialog helpers.

### Modified Capabilities

- None.

## Impact

Touches admin DI and consumers, repository fakes, web status/date utilities and call sites, period dialogs, tests, and public barrels. Internal injection contracts break intentionally; product behavior and API wire contracts remain stable.

## Non-goals

- No status derivation covered by `sweep15-status-derivation-ssot`.
- No redesign of confirmation copy or relative-time vocabulary; variants preserve current surface wording.
- No consolidation of domain-specific deadline formatting into past-relative formatting.
