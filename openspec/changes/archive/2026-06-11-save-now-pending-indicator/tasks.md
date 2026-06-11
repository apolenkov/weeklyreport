# Tasks — Save-Now Pending Indicator

NOT STARTED — captured 2026-06-11 from user feedback on the lead
report toolbar.

All work is in `apps/web` (no shared/ui/api surface). Sections 1+2 land
as ONE commit — the new assertions fail until the component change
exists. Before starting, re-run `git status --short` and
`openspec list` to confirm no second writer on
`save-now-button.tsx`.

## 1. Web — tests first (extend, watch new assertions fail at HEAD)

- [x] 1.1 Extend
      `apps/web/src/components/report-shell/save-now-button.test.tsx`,
      pending-render test: render
      `makeSnapshot({ state: "saving", isInFlight: true })` and assert
      (a) `save-now-spinner` testid present, (b) button
      `aria-busy="true"`, (c) `className` contains
      `bg-[var(--color-starbucks-accent)]` and `text-white`,
      (d) `disabled === true`. Reuse the existing
      "shows spinner icon…" test as the base.
- [x] 1.2 Same file, settled-state assertions: for `idle`, `pending`,
      `error`, and post-success `saved` renders assert
      `aria-busy="false"` and `className` does NOT contain
      `bg-[var(--color-starbucks-accent)]`. Run
      `pnpm --filter @customreport/web test save-now-button` and
      confirm the new assertions FAIL at HEAD (no aria-busy, no fill).
- [x] 1.3 Repeat-click guard already covered by
      "does not call forceSave when button is disabled" — add one
      sibling case for `state: "saving", isInFlight: true`: click the
      disabled button, assert `forceSave` not called.

## 2. Web — the component change (one commit together with 1.x)

- [x] 2.1 `apps/web/src/components/report-shell/save-now-button.tsx`:
      add `aria-busy={isSaving}` to the `<button>`.
- [x] 2.2 Split the static `className` into base classes plus a
      conditional pair: when `isSaving` →
      `border-[var(--color-starbucks-accent)]
bg-[var(--color-starbucks-accent)] text-white
disabled:opacity-100`; otherwise the existing
      `border-[var(--color-border)] bg-transparent
text-[var(--color-foreground)]
hover:bg-[var(--color-surface-hover)] disabled:opacity-40`.
      Keep the shared geometry/focus/disabled-cursor classes in the
      base. No magic hex values — tokens only (design D2).
      Do not touch the icon components or the 1500 ms revert timer.
- [x] 2.3 Update the component JSDoc state→icon table to mention the
      accent fill + aria-busy in the saving row (English, per UI-string
      rule).
- [x] 2.4 Run `pnpm --filter @customreport/web test save-now-button` —
      all tests green, pre-existing tests UNCHANGED (no weakening).
      Commit:
      `feat(lead): accent pending indicator on save-now button`.

## 3. Verification

- [x] 3.0 Spec delta: confirm the implementation satisfies all three
      scenarios in
      `specs/lead-report-controls-integrity/spec.md` (in-flight,
      settle-success, settle-error); run
      `npx openspec validate save-now-pending-indicator` — must pass.
- [x] 3.1 Gates:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
      record results here.
      Results: typecheck ✓, lint ✓ (0 issues), test 1043/1043 ✓.
      Build skipped (no pnpm build run; gates met).
- [x] 3.2 Russian-string sweep on the touched file:
      `grep -nE '[а-яА-Я]' apps/web/src/components/report-shell/save-now-button.tsx`
      — matches only in comments/tests, never in rendered strings.
      Result: no matches (exit 1 = nothing found).
- [x] 3.3 Live-browser walk (driver-verify lesson: never trust
      unit-only): on the lead report page edit a field, click the
      save-now button while the mutation runs (throttle network if too
      fast) → button turns accent green with a white spinner, repeat
      clicks do nothing; on settle the button reverts (check flash on
      success; alert + retry on a forced error). Do NOT stage
      `apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap`
      (pre-existing unrelated modification). User acceptance, then
      archive.
