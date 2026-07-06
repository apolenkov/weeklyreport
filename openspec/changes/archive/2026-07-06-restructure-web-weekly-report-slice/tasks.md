## 1. Dissolve components/weekly-report/ across four homes (behavior-neutral)

- [x] 1.1 `git mv` the 16 source files (+ tests + `__snapshots__`) from the top
      level and the `review/` subdir into `features/report-sections/ui`,
      `features/pdf-export/ui`, `features/period/ui`, `features/review/{ui,model}`
      per the mapping; remove the emptied `components/weekly-report/` tree.
- [x] 1.2 Rewrite imports (path.relative from each file's real old dir — files
      lived at two depths): intra-cluster siblings + the tree-wide consumers
      (head/viewer shells, reports/lead-preview routes, dashboard page).
- [x] 1.3 Repoint the `product-accordion` + `weekly-report-page` eslint exemptions
      to `features/report-sections/ui/`; add `current-week-section.tsx` to the
      `max-lines` exemption (latent lead-dissolve import-wrap overflow).

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors.
- [x] 2.2 Full web eslint `--max-warnings 0` clean (0 errors across src).
- [x] 2.3 Full web unit suite 1567 passing.
- [x] 2.4 Live-verify from source (`:3101`): `/head/report/[id]`, `/reports/[id]`,
      `/lead/report/[id]` all HTTP 200, no module-resolution 500.
- [x] 2.5 `openspec validate restructure-web-weekly-report-slice --strict` green.
