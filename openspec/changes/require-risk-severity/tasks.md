# Tasks

## 1. Contract

- [ ] 1.1 Inventory every Zod risk shape in `packages/shared` declaring `severity` optional; make each required (`riskSeveritySchema`, no default)
- [ ] 1.2 Drop `@default("at-risk")` from `Risk.severity` in `prisma/schema.prisma`; hand-edit the init migration; run `migrate reset` on `_dev` and `_test` (AI-consent env var required; seeds set severity explicitly — verify, fix any that relied on the default)

## 2. Dead-defense removal

- [ ] 2.1 Tighten `riskSeverityToCanonicalFloor` to `(severity: RiskSeverity)` with the exact two-value mapping; fix compile fallout by tightening callers' input types, never by re-widening
- [ ] 2.2 Remove the explicit-severity filter in `deriveEffectiveProductStatus` and the `=== "blocked" ? : "at-risk"` coercions in `deriveEffectiveStageStatus`/`deriveActivityStatus`; read-model risk types carry required `severity`
- [ ] 2.3 Update both characterization grids: drop the unset-severity permutation (the single ratified assertion change); all other rows byte-unchanged

## 3. Gates

- [ ] 3.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [ ] 3.2 `pnpm lint`
- [ ] 3.3 `pnpm test`
- [ ] 3.4 `pnpm --filter @customreport/api test:integration`
- [ ] 3.5 Live verify: create and edit a risk as a lead (both severities); confirm the dialog cannot submit without a level and chips/pills/published view agree
