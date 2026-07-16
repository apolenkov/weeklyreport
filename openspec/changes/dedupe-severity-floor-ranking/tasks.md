# Tasks

## 1. Characterization pins (before any move)

- [x] 1.1 Add characterization tests pinning current outputs of `deriveEffectiveStageStatus` and `applyRiskSeverityFloor` over the severity × items × explicit-status permutation grid, including the collapse-down cases
- [x] 1.2 Add characterization tests pinning `deriveEffectiveProductStatus`, `deriveActivityStatus`, and the `published-report-snapshot.ts` worst-of over the same grid (traffic vocabulary, incl. `null` handling)

## 2. Shared core

- [x] 2.1 Create `packages/shared/src/schemas/canonical-status.ts`: `CanonicalStatus`, precedence ladder, `worstCanonicalStatus`, `riskSeverityToCanonicalFloor`, `canonicalToTrafficLight`, `trafficLightToCanonical`; export from the package barrel
- [x] 2.2 Unit-test the shared core directly (ladder order, fold identity/empty, floor mapping, adapter round-trips incl. `null`/`empty` asymmetry)
- [x] 2.3 Check `eslint.config.ts` `status-type-ssot-gate` inventory and Zone allowlists; update entries that name `status-presentation.ts` in the same commit

## 3. Web adapter

- [x] 3.1 Delete `CanonicalStatus` and `PRECEDENCE`/`moreSevere` from `apps/web/src/lib/status-presentation.ts` / `stage-status.ts`; import the shared core; update every web import of `CanonicalStatus` to `@customreport/shared`
- [x] 3.2 Re-express the floor reduces in `deriveEffectiveStageStatus` and `lead-form-sync-bridge.tsx` `applyRiskSeverityFloor` via `riskSeverityToCanonicalFloor` + `worstCanonicalStatus`, keeping collapse-down logic untouched

## 4. API adapter

- [x] 4.1 Delete `severityToTraffic` from `report-sections.status-derivation.ts`; route through the shared floor + adapters; keep `aggregateTrafficLight` as the API-facing fold name
- [x] 4.2 Delete `statusSeverity` from `apps/api/src/modules/published-report-snapshot.ts`; use the domain fold

## 5. Gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [x] 5.2 `pnpm lint`
- [x] 5.3 `pnpm test`
- [x] 5.4 Verify characterization tests from section 1 are unchanged and green (no assertion edits after 1.1/1.2 — an assertion edit means a behavior change and fails this change)
