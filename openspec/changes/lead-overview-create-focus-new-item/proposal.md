# Change: Focus the new item after an Overview create save

## Why

Owner UX review 2026-11-02 (`~/work/handoffs/wr-ux-lead-critique-20261102/CRITIQUE.md`,
screenshot `ux-g/12-long-product-save.png`): after a Lead saves a new item with
"Save update" in a product with several rows, the composer closes and focus returns
to the opener (`use-overview-focus-return.ts`). The browser scrolls to that control,
the view lands on the next product, and the new row is above the viewport
(measured: row top −328 px). The Lead loses the place they just worked on and cannot
see that the item exists. No requirement defines focus after a plain create save;
cancel returns to the opener, "Save and add another" keeps the composer, and a direct
move focuses the moved item (`use-overview-moved-focus.ts`).

## What Changes

- After a successful plain "Save update" in create mode, keyboard focus moves to the
  newly created item's own Overview control (the identity-based target a direct move
  already uses) and the item is scrolled into view.
- Fallbacks: the original opener, then the Overview heading — never a control in an
  unrelated unit.
- Unchanged: cancel/edit focus return, "Save and add another", draft save path,
  payloads and server contracts.

## Impact

- Spec: `lead-status-overview-actions` (one ADDED requirement).
- Code: `apps/web/src/features/report-pages/ui/lead/shell/` (item editor focus after
  create); colocated tests.
- Backlog: see card linked in `tasks.md`.
