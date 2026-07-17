## Context

`AdminService` constructs five focused services and forwards their methods. `AdminRepository` keeps many production methods optional solely for old fakes, so services branch to empty/no-op behavior. Web status/date/dialog code repeats small policies that have already diverged.

## Goals / Non-Goals

**Goals:** inject focused services directly, make the repository contract truthful, centralize the residual traffic-status fold and shared date/dialog behavior, and delete pass-through wrappers.

**Non-Goals:** change tRPC schemas, authorization, admin transactions, date copy, dialog copy, or status rules owned by `sweep15-status-derivation-ssot`.

## Decisions

### 1. Nest owns focused admin service construction

`AdminModule` registers `SnapshotAdminService`, `ProjectAdminService`, `ReminderAdminService`, `PeriodAdminService`, and `ReopenRequestAdminService` using the same repository/logger dependencies and exports only services used externally. Routers receive the smallest service set for their procedures. Schedulers, processors, bootstrap, report-sections, tests, and `RouterDeps` do the same. `AdminService` and facade-only tests are deleted; behavior tests move to the owning service/router.

### 2. Production repository methods are all required

Remove optional markers and service `?.`/fallback branches for reminder policy, period lifecycle, group-product, and related methods. Every fake spreads `unusedAdminRepositoryStubs()` and overrides methods it exercises. The stubs expand to the complete unused surface and remain test-only; production implementations cannot silently omit a capability.

Before: router → `AdminService` → focused service → optional repository method → fallback.

After: router → focused service → required repository method.

### 3. One residual traffic fold

Add `worstTrafficStatus(values)` in the canonical web status utility, supporting the shared traffic scale and the documented empty/null handling needed by residual consumers. Migrate the slide-grid/slide-merge and weekly presentation rank copies remaining after `sweep15-status-derivation-ssot`. Do not absorb domain derivation functions owned by that change or stage-specific completeness ordering without an explicit adapter.

### 4. Canonical date functions own both absolute and past-relative display

Call sites import `formatPeriodRangeWithYear`, `isoWeekNumber`, and related functions from `lib/format-date`; feature wrappers that only forward are deleted. Add `formatRelativePast(date, now, variant?)`, with named variants preserving current compact (`1h ago`), long (`1 hour ago`), and activity (`30s ago`, then short date) vocabularies. `now` is mandatory for deterministic model tests; UI callers pass a captured/current time.

Deadline countdowns remain separate because they describe future/past state, not an elapsed timestamp.

### 5. ConfirmationDialog absorbs the two bespoke confirmations

Add only the variants/content slots needed by fill-from and period delete. Preserve focus trap/restore, Escape, backdrop, destructive styling, pending disable, and trigger focus behavior. Delete the bespoke components and migrate their tests to shared-dialog integration tests.

Load-bearing period dual-state and role-coverage behavior is preserved; no DB migration or feature flag is required.

## Risks / Trade-offs

- [Large DI fan-out] → Give each router a typed dependency object containing only its focused services.
- [Required-port migration breaks many tests] → Expand the shared unused stubs first, then enable required methods.
- [Formatter consolidation changes strings] → Freeze a cross-variant fixture matrix before migration.
- [Status helper conflates different domains] → Limit inputs/outputs and explicitly exclude stage completeness and server derivation helpers.

## Migration Plan

Make repository methods required and fix fakes, register focused services, migrate consumers, then delete the facade. Land web helper/dialog slices independently. Rollback is code-only.

## Open Questions

None.
