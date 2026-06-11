## Context

The four admin CRUD dialogs are hand-rolled overlays, not Radix `Dialog`.
Each is conditionally rendered (`showDialog && (...)` / `showCreate && (...)`)
with a manual document-level Escape listener:

- Users: `apps/web/src/components/admin/users-tab.tsx:371` (overlay),
  Escape wired at `:95-105`, `role="dialog"` + `aria-modal` at `:381-382`,
  first control `id="user-name"` at `:398`.
- Products: `apps/web/src/components/admin/products-tab.tsx:358` (overlay),
  `role="dialog"` at `:367`, first control `id="product-name"` at `:384`.
- Groups: `apps/web/src/components/admin/groups-tab.tsx:283` (overlay),
  `role="dialog"` at `:293`, first control `id="group-name"` at `:310`.
- Periods: `apps/web/src/components/admin/periods-tab-dialog.tsx` —
  `CreatePeriodDialog` exported at `:57`, `role="dialog"` at `:171`,
  first control `id="period-start"` at `:191`; mounted from
  `periods-tab.tsx:250-251` behind `showCreate`.

None of the four moves focus inside on open. Verified by reading: there is no
`autoFocus`, no `onOpenAutoFocus`, no `.focus()` call, and no focus-restoring
ref in any of the four files (grep for `autoFocus|focus()|useRef` over the admin
dir returns only unrelated state hooks). This matches the archived observation
at `archive/2026-06-10-verify-a11y-recommended-flip/tasks.md:162` —
`document.activeElement` stays `<body>` on open.

The lead surface already solves the focus-on-open half, two ways:

1. Static `autoFocus` on the first interior control —
   `apps/web/src/components/lead/item-edit-dialog.tsx:258` (Description
   textarea), `decision-edit-dialog.tsx:198`, `risk-edit-dialog.tsx:309`.
2. rAF-deferred `.focus()` on a ref, for portal-mounted dialogs —
   `apps/web/src/components/lead/confirm-delete-dialog.tsx:71-80`.

Neither lead pattern restores focus to the trigger on close. Verified: no
`previouslyFocused` / `activeElement` save-and-restore exists anywhere under
`apps/web/src/components`. So the restore-on-close half of this change is NEW.

## Goals / Non-Goals

**Goals:**

- Each admin dialog moves focus to its first meaningful control on open
  (users → name, products → name, groups → name, periods → start date).
- Each admin dialog returns focus to the opening trigger on every close path:
  Escape, Cancel, overlay click, and successful save.
- Regression tests assert both halves per dialog.

**Non-Goals:**

- No migration of these dialogs to Radix `Dialog` / a shared dialog primitive.
  That is a larger refactor; this change is surgical autofocus + restore on the
  existing hand-rolled overlays.
- No focus-trap (Tab cycling confined to the dialog). The observation only
  flagged focus-on-open; a trap is a separate, larger a11y task.
- No change to the lead dialogs. They already focus on open; retrofitting
  restore-on-close there is out of scope here.
- No new color tokens, no UI-string changes, no backend/schema/dependency
  change.

## Decisions

### D1 — Focus the first meaningful control on open, not the dialog container

Each dialog already has a stable first form control with a known `id`. Focusing
that control (rather than a `tabIndex={-1}` container) means the first Tab moves
to the second field, which is the expected keyboard flow. The lead item dialog
sets the precedent by focusing its Description textarea directly
(`item-edit-dialog.tsx:258`).

For the users/products/groups overlays, which are inline-rendered (not
portaled), a static `autoFocus` on the first control is sufficient and matches
`item-edit-dialog.tsx:258`. The required `jsx-a11y/no-autofocus` suppression
carries the same justification comment already used at that line. Where the
existing edit-vs-add branch reuses one dialog body, the first control is the
same element in both modes, so one `autoFocus` covers add and edit.

### D2 — Restore focus to the trigger via a saved-element ref

On open, capture `document.activeElement` into a ref before focus moves inside;
on the transition back to closed, call `.focus()` on the saved element. The
trigger elements are known: users `:256`/`:317`, products `:216`/`:288`, groups
`:186`/`:252`, periods `periods-tab.tsx:145`. Capturing the live
`activeElement` rather than a hard ref to one button keeps add and edit (which
have different triggers) correct without extra wiring.

### D3 — One requirement, four dialogs; tests are the contract

The durable property is "admin CRUD dialogs manage focus on open and close".
The spec states it once with a scenario per behavior half; tasks enumerate the
four dialogs. Each dialog gets a co-located test asserting focus-on-open lands
on the first control and that close restores focus to the trigger, so a future
edit that drops either half fails the suite.

## Risks / Trade-offs

- jsdom does not honour `autoFocus` for conditionally-rendered elements — the
  same caveat already documented at
  `weekly-report/publish-lock-button.test.tsx:318-326`. Tests assert focus by
  the structural proxy used there (the control is focusable and receives focus
  on mount), or drive focus explicitly, rather than relying on jsdom autoFocus.
- Restore-on-close depends on the trigger still being mounted. After a save the
  table re-renders, but the Add button (and the per-row Edit button for the
  still-present row) remain, so the saved element is valid; if a row is deleted
  its Edit trigger is gone — delete uses the separate confirm dialog, not these
  CRUD dialogs, so this path is not exercised here.
- This touches a regression-heavy admin area. Changes are additive (focus
  wiring only); no query semantics, no state shape, no markup beyond the
  `autoFocus` attribute and a ref, keeping blast radius minimal.

### Invariants

- Period dual-state: untouched — no `periodState`/period-tuple writes.
- Role-coverage gate: untouched — no tRPC procedure changes.
- Destructive-db guard: untouched — no DB ops.
- Deferred-feature pattern: untouched — no deferral; this ships behavior.
- Status-color-semantics / ui-control-density: untouched — no token or density
  change.
