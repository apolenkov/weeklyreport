## 1. Stop the deep-link effect from re-firing on data-only refetches

- [ ] 1.1 `apps/web/src/features/admin/ui/products-tab.tsx`: locate the
      deep-link auto-expand effect, currently keyed
      `[productFilter, products]`
- [ ] 1.2 Add an interaction marker (ref or state) set the first time the
      user manually toggles the deep-linked panel (expand or collapse)
- [ ] 1.3 Guard the effect so it only acts on `products` changes before the
      marker is set (initial deep-link load); once the user has manually
      toggled, the effect re-runs only on `productFilter` changes
- [ ] 1.4 Confirm the marker resets appropriately if the user navigates to a
      genuinely new `?product=<id>` deep link (new `productFilter`), so a
      fresh deep-link target still auto-expands once

## 2. Tests

- [ ] 2.1 `products-tab.test.tsx`: existing test — deep-link auto-expands on
      initial load — still passes unmodified
- [ ] 2.2 New test: user collapses the deep-linked panel, `products`
      reference changes (simulated refetch), assert panel stays collapsed
- [ ] 2.3 New test: `productFilter` changes to a new id, assert the
      newly-targeted panel still auto-expands

## 3. Spec delta

- [ ] 3.1 `admin-settings-ui`: ADD a requirement that the products-tab
      deep-link auto-expand does not re-fire on data-only refetches after
      the user has manually toggled the panel

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 Manual/Playwright drive: deep-link into a product panel, collapse
      it, mutate a different product in the same tab, confirm the panel
      stays collapsed after refetch
- [ ] 4.4 `openspec validate admin-products-tab-state --strict`
