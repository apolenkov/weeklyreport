# Tasks

The full per-file / per-block / per-DOM regression-test catalog (480 tests)
lives in `design.md`. Sections 0–4 below turn it into runnable coverage; the
catalog is the source of truth for _what_ to assert.

## 0. Implement the regression catalog (from `design.md`)

- [x] VA-0a Land the **266 high-priority** `unit-rtl` tests first — these are
      colocated RTL render+assert checks for DOM attributes (aria-hidden,
      type="button", roles, stable keys) and the dialog keyboard-closability
      claims. Extend the existing test file for the 27 files that already have
      one; create a colocated `*.test.tsx` for the rest.
      → DONE 2026-06-08 via Workflow `verify-a11y-va0-catalog` (one Sonnet agent
      per target test file + an adversarial verify stage for behavioral
      dialog/keyboard files). 55 target files landed green (the 56th,
      `nav-bar-skeleton`, has an empty catalog section — nothing in-scope to
      assert, correctly skipped). Each agent implemented only the `high` +
      `unit-rtl` and all `snapshot` rows, asserting against the real source
      (behavioral rows fire real Escape/click/focus and assert unmount /
      callback / activeElement, not just render).
- [x] VA-0b Add/refresh the 56 `snapshot` entries (decorative-SVG aria-hidden
      churn etc.) where a DOM snapshot is the cheapest guard.
      → DONE 2026-06-08 (same Workflow; snapshot rows landed alongside VA-0a per
      file; `__snapshots__/` dirs committed).
- [ ] VA-0c Defer the 6 `playwright-e2e` entries to the per-role runtime sweep
      below (they need a live browser + role login).
- [x] VA-0d Run `pnpm test`; confirm the new tests pass and overall suite stays
      green.
      → DONE 2026-06-08: full suite green — web 888 (was 582, +306 new cases),
      shared 577, api 867. typecheck 5/5, lint 0 errors / 0 warnings (6 agent
      lint/tsc slips fixed by hand: 4 string→Date / unused-var / type-assertion,
      plus 4 `!`→guard rewrites to keep the warn-baseline at 0).

Drive a live dev server (`pnpm dev:fresh`, `AUTH_DEV_MODE=true`) and verify per
role via `/auth/dev-login?role=<ROLE>`. Capture console; ERROR → fail, WARNING →
log, favicon 404 → ignore. Behavior assertions are interaction checks, not just
console.

## 1. Keyboard navigation (status-slide deck)

- [ ] VA-1 Head/Viewer: open the status-slide deck; confirm the slide region is
      focusable and arrow/Enter/Space navigation works via keyboard alone
      (the role/tabIndex + onKeyDown added in `c4610797`). 0 console ERRORS.

## 2. Dialog keyboard-closability (the backdrop suppressions)

For each dialog whose backdrop was `biome-ignore`d as "keyboard-closable via
Escape + Cancel/close button", confirm the claim at runtime:

- [ ] VA-2 Lead: item-edit, decision-edit, risk-edit, confirm-delete,
      request-reopen dialogs — each opens, Escape closes it, the Cancel/close
      button closes it, and initial focus lands inside the dialog (the kept
      `autoFocus`). 0 console ERRORS.
- [ ] VA-3 Admin: periods-tab (incl. the delete dialog that gained a new Escape
      handler), users-tab, products-tab, groups-tab dialogs — Escape + Cancel
      both close; backdrop click closes (mouse convenience intact). 0 console
      ERRORS.

## 3. Interactive semantics

- [ ] VA-4 report-shell `lock-badge` and `users-tab` interactive elements:
      reachable and operable by keyboard; tabindex change did not strand focus.

## 4. Sign-off

- [ ] VA-5 Record per-role results. If any interaction fails or a suppressed
      backdrop dialog is NOT keyboard-closable, open a follow-up fix change —
      do NOT patch under this acceptance-only change — then archive this one.
- [ ] VA-6 With all behavior checks passing and 0 console ERRORS per role,
      mark verified and archive.

## 5. Parked from fix-ui-role-access-inconsistencies (runtime-only checks)

These two need a live browser + per-role login, so they were parked here when
`fix-ui-role-access-inconsistencies` landed its deterministic fixes (preview
lead-only guard + role-resolved denial home link).

- [ ] VA-7 Preview route lead-only, per role: under `/auth/dev-login?role=<ROLE>`
      open `/lead/report/:id/preview`. Lead → renders the preview content;
      head/admin/viewer → in-page `ForbiddenPage` wall at the same URL. The
      wall's "Go to dashboard" link points to each role's own home
      (`roleHomePath`). 0 console ERRORS.
- [ ] VA-8 `WeeklyReportSkeleton` hydration mismatch (finding A6): reproduce the
      per-load console error on the preview page and fix the real cause.
      Investigated source-only and the skeleton itself is static (`role="status"`,
      constant aria) — so the finding mis-located it. Concrete lead to check
      first: the SSR `<Suspense fallback={<WeeklyReportSkeleton/>}>`
      (`role="status"`) vs `LeadSectionPreviewAuth`'s `isLoading` pulse branch
      (a plain `<div>` with no `role="status"`) — the server/client boundary may
      swap one for the other. Do NOT commit a speculative fix without the live
      error in hand.
- [ ] VA-9 (re-homed orphan O6 from `establish-scenario-catalog`): verify the
      deferred-feature coming-soon UI cards render correctly per role. The
      reference pattern is `LanguageComingSoonControl` / `ThemeComingSoonControl`
      in `apps/web/src/components/navigation/nav-bar.tsx` (an inert control with a
      `ComingSoonBadge` tooltip). Under `/auth/dev-login?role=<ROLE>`, confirm each
      role sees the acknowledged-but-inert control (not a hidden flag, not a
      half-working feature) and that the badge/tooltip is keyboard-reachable. Live
      app + per-role login (groups with VA-1..VA-8).
