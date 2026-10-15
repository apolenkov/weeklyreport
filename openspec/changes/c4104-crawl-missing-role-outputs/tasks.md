# Tasks

## 1. Contract

- [x] 1.1 State that missing crawl outputs are reported with role and reason
      in single-run and merged reports (C4104).

## 2. Implementation

- [x] 2.1 Repository regressions for corrupt/missing role output and a pass
      without `report.json`, failing before the change.
- [x] 2.2 Report missing roles and passes in `crawl.ts`, `merge.ts` and
      `report.ts`; keep raw outputs; non-zero exit.
- [ ] 2.3 Full gates and independent review.
