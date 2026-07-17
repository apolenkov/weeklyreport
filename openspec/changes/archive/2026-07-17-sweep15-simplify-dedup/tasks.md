## 1. Required admin repository contract

- [x] 1.1 Inventory every optional `AdminRepository` method and its current service fallback; add behavior characterization where a real production path exists.
- [x] 1.2 Expand `unusedAdminRepositoryStubs()` to cover the complete unused production contract with explicit neutral test results.
- [x] 1.3 Remove optional markers from reminder-policy, period lifecycle/manual, group-product, and remaining production methods; update all fakes to spread stubs and override exercised methods.
- [x] 1.4 Remove service optional chaining/not-implemented/empty fallbacks and prove incomplete production repositories fail typecheck.

## 2. Remove AdminService facade

- [x] 2.1 Register and export the five focused admin sub-services in `AdminModule` with the existing repository/logger wiring.
- [x] 2.2 Change `RouterDeps` and admin procedure groups to receive only their owning focused services; preserve middleware builders, inputs, outputs, audits, and error mapping.
- [x] 2.3 Migrate report-sections, period schedulers, email processor, `main.ts`, `app.module.ts`, and other non-router consumers from `AdminService` to focused services.
- [x] 2.4 Move facade behavior assertions to focused service/router tests, delete facade-only test setup, and remove `admin.service.ts` plus its exports/provider.
- [x] 2.5 Search production/tests for `AdminService` and verify no imports, casts, stubs, or comments remain.

## 3. Status and date deduplication

- [x] 3.1 After `sweep15-status-derivation-ssot` lands, inventory only residual web traffic-rank/worst-of copies and record deliberate exclusions for domain/stage-specific rules.
- [x] 3.2 Add tested `worstTrafficStatus` to the canonical web status utility and migrate residual slide-grid/slide-merge/weekly presentation consumers.
- [x] 3.3 Inventory pass-through date wrappers, migrate consumers to `lib/format-date`, and delete wrappers/re-exports that add no semantics.
- [x] 3.4 Add a boundary-value fixture matrix for the three past-relative vocabularies, implement `formatRelativePast(date, now, variant?)`, and migrate activity, history, and lead-form consumers.
- [x] 3.5 Keep deadline countdown formatting separate and verify no user-facing date strings change accidentally.

## 4. Shared confirmations

- [x] 4.1 Extend `ConfirmationDialog` props/presets only as needed for fill-from context, period-delete destructive styling, and pending disable.
- [x] 4.2 Replace `FillFromConfirmDialog` and `PeriodsDeleteConfirmDialog` call sites with `ConfirmationDialog`, preserving copy, confirm/cancel behavior, focus lifecycle, and trigger restoration.
- [x] 4.3 Delete the bespoke dialog components/tests and add shared/integration coverage for both flows.

## 5. Focused verification

- [x] 5.1 Run focused admin service/router/repository tests and the TypeScript incomplete-repository fixture.
- [x] 5.2 Run focused status/date formatter and fill-from/period-delete dialog tests.
- [x] 5.3 Run `pnpm build` to catch public-barrel or DI cycles after facade removal.

## 6. Repository gates

- [x] 6.1 `pnpm --filter @customreport/api db:generate`
- [x] 6.2 `pnpm typecheck`
- [x] 6.3 `pnpm lint`
- [x] 6.4 `pnpm test`

## 7. Adversarial review closure

- [x] 7.1 Split the published-lineage query assembly into functions at or below 50 lines without changing the batched query shape or lineage semantics.
