# Tasks — Autofocus Admin Dialogs

Decisions D1-D3: `design.md`. Evidence anchors: `proposal.md` + `design.md`.
NOT STARTED — captured 2026-06-10 (follow-up recommended at
`openspec/changes/archive/2026-06-10-verify-a11y-recommended-flip/tasks.md:162`;
implement on go-ahead).

## 1. Web — periods create dialog (D1, D2)

- [x] 1.1 `apps/web/src/components/admin/periods-tab-dialog.tsx`: add focus-on-
      open to the first control (`id="period-start"`, `:191`), matching the
      `autoFocus` precedent at `lead/item-edit-dialog.tsx:258` (carry the same
      `jsx-a11y/no-autofocus` justification comment).
- [x] 1.2 Same file / `periods-tab.tsx`: capture the trigger
      (`periods-tab.tsx:145` create-period button) on open and restore focus to
      it on every close path (Escape `:95-101`-style listener, Cancel `:271`,
      overlay `:163`, and `onCreateSuccess` `periods-tab.tsx:99`).

## 2. Web — users dialog (D1, D2)

- [x] 2.1 `apps/web/src/components/admin/users-tab.tsx`: focus the first control
      (`id="user-name"`, `:398`) on open in both add and edit modes.
- [x] 2.2 Same file: capture the trigger (Add `:256`, per-row Edit `:317`) on
      open; restore focus on Escape (`:95-105`), Cancel (`:485`), overlay
      (`:374`), and save success (`:112`).

## 3. Web — products dialog (D1, D2)

- [x] 3.1 `apps/web/src/components/admin/products-tab.tsx`: focus the first
      control (`id="product-name"`, `:384`) on open in both add and edit modes.
- [x] 3.2 Same file: capture the trigger (Add `:216`, per-row Edit `:288`) on
      open; restore focus on Escape (`:47-56`), Cancel (`:415`), overlay
      (`:361`), and save success (`:92`).

## 4. Web — groups dialog (D1, D2)

- [x] 4.1 `apps/web/src/components/admin/groups-tab.tsx`: focus the first control
      (`id="group-name"`, `:310`) on open in both add and edit modes.
- [x] 4.2 Same file: capture the trigger (Add `:186`, per-row Edit `:252`) on
      open; restore focus on Escape (`:71-80`), Cancel (`:396`), overlay
      (`:286`), and save success (`:87`).

## 5. Tests (D3)

- [x] 5.1 In each co-located test (`users-tab.test.tsx`, `products-tab.test.tsx`,
      `groups-tab.test.tsx`, `periods-tab.test.tsx`): assert focus-on-open lands
      on the dialog's first control. Use the jsdom-autoFocus-safe structural
      proxy from `weekly-report/publish-lock-button.test.tsx:318-326` (control
      is focusable and receives focus on mount), not raw jsdom `autoFocus`.
- [x] 5.2 In each co-located test: open the dialog from a trigger, close it, and
      assert focus returns to that trigger.

## 6. Gates + verification + acceptance

- [x] 6.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; all
      green. Confirm any new `autoFocus` site carries a justified
      `eslint-disable-next-line jsx-a11y/no-autofocus` comment (no broadened
      lint config).
- [x] 6.2 Confirm no Russian in changed `apps/web/src/**/*.tsx`
      (`grep -nE '[а-яА-Я]'` on each changed file; matches must be comments or
      data only); no new color token; no UI-string change.
- [ ] 6.3 Manual a11y check (per the original observation): open each admin
      dialog by keyboard, confirm `document.activeElement` moves inside on open
      and returns to the trigger on close — closing the
      `tasks.md:162` follow-up.
- [ ] 6.4 `openspec validate autofocus-admin-dialogs --strict` passes;
      `npx prettier --check` on the change dir is clean.
- [ ] 6.5 User acceptance: confirm the focus-on-open + restore-on-close behavior
      matches expectations across all four admin dialogs before archiving.
