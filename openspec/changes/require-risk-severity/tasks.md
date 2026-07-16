# Tasks

## 1. Contract

- [x] 1.1 Inventory every Zod risk shape in `packages/shared` declaring `severity` optional; make each required (`riskSeveritySchema`, no default)
- [x] 1.2 Drop `@default("at-risk")` from `Risk.severity` in `prisma/schema.prisma`; hand-edit the init migration; run `migrate reset` on `_dev` and `_test` (AI-consent env var required; seeds set severity explicitly — verify, fix any that relied on the default)

## 2. Dead-defense removal

- [x] 2.1 Tighten `riskSeverityToCanonicalFloor` to `(severity: RiskSeverity)` with the exact two-value mapping; fix compile fallout by tightening callers' input types, never by re-widening
- [x] 2.2 Remove the explicit-severity filter in `deriveEffectiveProductStatus` and the `=== "blocked" ? : "at-risk"` coercions in `deriveEffectiveStageStatus`/`deriveActivityStatus`; read-model risk types carry required `severity`
- [x] 2.3 Update both characterization grids: drop the unset-severity permutation (the single ratified assertion change); all other rows byte-unchanged

## 3. Gates

- [x] 3.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [x] 3.2 `pnpm lint`
- [x] 3.3 `pnpm test`
- [x] 3.4 `pnpm --filter @customreport/api test:integration`
- [x] 3.5 Verified via layered evidence: Zod negative test (payload without severity rejected), DB column NOT NULL without default confirmed on both reset DBs, advanced reseed green with explicit severities, and the prior live browser walk exercising risk-derived chips
