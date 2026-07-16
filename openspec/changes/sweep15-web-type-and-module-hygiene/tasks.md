## 1. Canonical types and weekly projection

- [x] 1.1 Confirm `sweep15-live-report-type-ssot` and `admin-presentation-type-ssot` are landed or composed without overlap, then replace only the residual three local `PeriodStatus` declarations in `admin-mock-data.ts`, `admin-types.ts`, and `weekly-report-page-helpers.ts` with type imports from `@customreport/shared`.
- [x] 1.2 Add complete-output characterization tests for `mapWeeklyReport`, including empty data, attention, lead labels, status/null mapping, counts, period metadata, and record slices.
- [x] 1.3 Extract immutable lookup/context construction and a pure per-product paired projection; derive portfolio/products without mutable accumulators.
- [x] 1.4 Split period/result assembly into functions at or below 50 lines and verify `mapWeeklyReport` output parity.

## 2. Print template decomposition

- [x] 2.1 Add/refresh print tests that lock loading, error, ready markers, executive summary, portfolio, lead-section DOM, and representative print selectors before extraction.
- [x] 2.2 Reduce `print-report-template.tsx` to query/controller and mutually exclusive outcome selection.
- [x] 2.3 Extract the portfolio table into `print-portfolio-table.tsx` with typed, fetch-free props.
- [x] 2.4 Extract lead/product content into `print-lead-section.tsx` with stable DOM order and record rendering.
- [x] 2.5 Extract the executive summary into `print-executive-summary.tsx` and print declarations into `print-report-styles.tsx` or a scoped stylesheet.
- [x] 2.6 Remove the inline `max-lines` disable and run focused print/PDF readiness tests plus a visual print comparison.

## 3. Slide model decomposition

- [x] 3.1 Freeze integrated `section-slide-utils` output fixtures for products, activities, pagination, Everyone foreign merge, and product scope.
- [x] 3.2 Extract activity projection and section-model composition into separate model modules with directed leaf imports.
- [x] 3.3 Extract pagination into a pure module and preserve page identity/order/limits.
- [x] 3.4 Extract foreign-content merge into a pure module and preserve author attribution and health folding.
- [x] 3.5 Extract product-scoped transformations into a pure module and preserve cross-product exclusions and scope selection.
- [x] 3.6 Reduce or remove `section-slide-utils.ts`, update consumers/tests without creating a replacement god-barrel, and remove its `eslint.config.ts` exemption entries.

## 4. Focused verification

- [x] 4.1 Run focused weekly-report mapper, print-template, PDF-readiness, and slide-model test files.
- [x] 4.2 Run `pnpm build` to verify extracted module graphs and print/slide bundle evaluation.
- [x] 4.3 Check every changed production `.tsx` file with `grep -nE '[а-яА-Я]' <file>` and confirm each hit is permitted data/comment/test content.

## 5. Repository gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`

## 6. Adversarial review closure

- [x] 6.1 Split the extracted print portfolio table and slide product projection helpers so every touched production function remains at or below 50 lines.
