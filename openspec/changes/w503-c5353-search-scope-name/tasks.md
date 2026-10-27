# Tasks

## 1. Contract

- [x] 1.1 Delta `search-input-accessible-name`: the shared search combobox names itself after the effective scope.
- [x] 1.2 Validate the change with `pnpm exec openspec validate w503-c5353-search-scope-name --strict`.

## 2. Web behaviour

- [x] 2.1 RED then GREEN in `apps/web/src/shared/ui/search/search-input.test.tsx`: `all` with the products placeholder exposes "Search reports and products", `mine` and `published` expose "Search reports", and an overridden placeholder does not rename the control.
- [x] 2.2 Derive the label from the scope in the shared search component; keep the placeholder, `name`, popup relationships, debounce and navigation unchanged.
- [x] 2.3 Refresh the `SearchInput` double in `apps/web/src/app/(app)/reports/page.test.tsx` to the real report-scope name.

## 3. Verification

- [x] 3.1 Focused Vitest for the shared search control; changed-file prettier and eslint; `pnpm --filter @weeklyreport/web typecheck`.
- [x] 3.2 `pnpm spec:check` on the integrated tree.
- [ ] 3.3 Native screen-reader confirmation on the products and report-history surfaces; owned by the parent integration.
