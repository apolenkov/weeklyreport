# Tasks

## 1. Ratify

- [ ] 1.1 Confirm the chosen semantics with the product owner (recommended: any covering risk floors to at-risk, unset severity included) — do not implement past this task without it

## 2. Implement

- [ ] 2.1 Remove the explicit-severity eligibility filter in `deriveEffectiveProductStatus`; feed all covering risks through the shared floor
- [ ] 2.2 Extend both characterization grids (web stage floor, API product/activity derivation) with the unset-severity permutation asserting identical outputs
- [ ] 2.3 Sweep dashboard/snapshot/slide expectations for fixtures that relied on the old filter and update them to the ratified semantics

## 3. Gates

- [ ] 3.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [ ] 3.2 `pnpm lint`
- [ ] 3.3 `pnpm test`
- [ ] 3.4 `pnpm --filter @customreport/api test:integration`
- [ ] 3.5 Live verify: create a covering risk without severity as a lead; confirm the stage chip, product pill, and published read model agree
