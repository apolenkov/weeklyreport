# Tasks

## 1. Contract

- [x] 1.1 Record the 008 + independent reviewer role and input-guard policy (C4168).

## 2. Implementation

- [ ] 2.1 Regressions in the existing owners: `full-plan.test.ts` guard cases
      and native probe → `fullControlReason` cases in
      `observations.browser.test.ts`, failing before the change.
- [ ] 2.2 Implicit input roles in `probe.ts`; tag+type input guard in
      `full-plan.ts`.
- [ ] 2.3 Native fixture run in a granted window, six gates on the final
      tree and independent review.
