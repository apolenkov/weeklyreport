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
- [x] VA-0c Defer the 6 `playwright-e2e` entries to the per-role runtime sweep
      below (they need a live browser + role login).
      → DONE 2026-06-10: the 6 e2e rows are all live-browser interaction checks
      (dialog Escape-unmount, Tab-order-not-stranded, autoFocus + focus-return,
      and the `script#__org_data` first-paint fidelity row). Each is subsumed by
      the per-role runtime sweep below — dialog rows by VA-2/VA-3, focus/Tab rows
      by VA-2/VA-4, `__org_data` first-paint by the per-role render checks. No
      standalone Playwright spec stood up (proposal non-goal: no parallel sweep);
      verified through the Driver (Playwright MCP) per role instead.
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

- [x] VA-1 Head/Viewer: open the status-slide deck; confirm the slide region is
      focusable and arrow/Enter/Space navigation works via keyboard alone
      (the role/tabIndex + onKeyDown added in `c4610797`). 0 console ERRORS.
      → VERIFIED 2026-06-10 (Driver, Playwright MCP, head). Route
      `/head/report/[id]?mode=slides` renders `StatusSlideDeck`. The `<section>`
      has `aria-label="Status slide deck (use arrow keys to navigate slides)"` +
      `tabIndex=0`; `.focus()` lands on it. ArrowRight advanced the live slide
      (article "Аналитический хаб" → "Платформа e-commerce"); ArrowLeft retreated
      back — observed DOM change, not just render. Enter on the focused Next
      `<button>` also advanced the slide (native button activation). 0 console
      ERRORS; console capture confirmed live via the DRIVER_CANARY_42 proof
      (canary detected). Source: the section `onKeyDown` handles ArrowLeft/Right
      only; Enter/Space act on the real `<button>`s natively (correct).
      NOTE (task-wording vs code, not a defect): the **viewer** does NOT render
      `StatusSlideDeck`. Viewer presentation (`/reports/[id]/present`) is a
      separate scroll/accordion deck (its own "1/15" ←/→ nav) that is OUTSIDE the
      `c4610797` a11y delta; `?mode=slides` is a head/lead editorial toggle the
      viewer read-only shell ignores. The c4610797 behavior is verified where it
      renders (head). Catalog/task left untouched (a divergence is a doc call).

## 2. Dialog keyboard-closability (the backdrop suppressions)

For each dialog whose backdrop was `biome-ignore`d as "keyboard-closable via
Escape + Cancel/close button", confirm the claim at runtime:

- [x] VA-2 Lead: item-edit, decision-edit, risk-edit, confirm-delete,
      request-reopen dialogs — each opens, Escape closes it, the Cancel/close
      button closes it, and initial focus lands inside the dialog (the kept
      `autoFocus`). 0 console ERRORS.
      → VERIFIED 2026-06-10 (Driver, Playwright MCP). All five dialogs exercised
      live; for each: opened with `role="dialog"` + `aria-modal="true"`, initial
      focus landed INSIDE the dialog (item/decision/risk/request-reopen → the
      autoFocus `<textarea>`; confirm-delete → the autoFocus confirm `<button>`),
      real Escape keypress removed the dialog node from the DOM, and reopening +
      clicking the "Cancel" button removed it again. confirm-delete was driven on
      a real risk row ("Delete risk for CRM-Sales Hub"); Escape cancelled WITHOUT
      deleting (the row trigger was still present afterward) — the destructive
      path was never confirmed. Request-reopen tested on lead1@ (submitted report
      a0…001); the four edit/delete dialogs needed an editable section, so driven
      on boris@ (draft section). 0 real console ERRORS across the whole lead
      session (the only console error is the deliberate DRIVER_CANARY_42 proof).
- [x] VA-3 Admin: periods-tab (incl. the delete dialog that gained a new Escape
      handler), users-tab, products-tab, groups-tab dialogs — Escape + Cancel
      both close; backdrop click closes (mouse convenience intact). 0 console
      ERRORS.
      → VERIFIED 2026-06-10 (Driver, Playwright MCP, admin@). All four tabs
      exercised on a real dialog each, all `role="dialog"` + `aria-modal="true"`,
      and for EACH all three close paths confirmed by observed DOM removal —
      Escape, "Cancel", AND a real click on the `fixed inset-0` backdrop overlay
      (the backdrop-onClick is exactly the behavior the `biome-ignore`
      suppressions exist to preserve, so it was checked on every dialog, not just
      one):
      · periods "Delete period" (the dialog that gained the new Escape handler)
      — Escape ✓, Cancel ✓, backdrop-click ✓. The destructive delete was
      never confirmed (close-paths only; the period row remained afterward).
      · users "Add User" — Escape ✓, Cancel ✓, backdrop-click ✓.
      · products "Add Product" — Escape ✓, Cancel ✓, backdrop-click ✓.
      · groups "Add Group" — Escape ✓, Cancel ✓, backdrop-click ✓.
      0 console ERRORS across the admin session.
      OBSERVATION (not a VA-3 failure, logged per VA-5): unlike the lead dialogs,
      the admin dialogs do NOT move initial focus inside on open
      (`document.activeElement` stays `<body>`; no autoFocus). Escape still closes
      because the handler is document-level, not focus-scoped — so the VA-3 claim
      (Escape + Cancel + backdrop close) holds. The weaker focus-on-open is an
      a11y gap outside this change's c4610797 delta (the delta added the periods
      Escape handler, not focus management); recorded for a future a11y pass, no
      fix here (acceptance-only).

## 3. Interactive semantics

- [x] VA-4 report-shell `lock-badge` and `users-tab` interactive elements:
      reachable and operable by keyboard; tabindex change did not strand focus.
      → VERIFIED 2026-06-10 (Driver, Playwright MCP).
      lock-badge (lead form, boris@ — 8 live foreign-card badges authored by
      Мария К. / Василий И.): each is `role="img"` with the read-only aria-label,
      `tabIndex` is ABSENT (the c4610797 change removed `tabIndex={0}`), and the
      child `<svg>` keeps `aria-hidden="true"`. Calling `.focus()` on a badge did
      NOT make it `document.activeElement` (focus fell through to `<body>`) — it
      is correctly OUT of the tab order. A real Tab press from "Add item to
      Платформа интеграций" advanced focus to the next real `<button>` ("Edit"),
      never to a badge — focus is not stranded, the badge is skipped.
      users-tab (admin@): the "Add new user" `<button>` is in natural tab order
      (no negative tabindex), `.focus()` lands on it, and a real Enter keypress
      opened the Add-User dialog (keyboard-operable); the Plus icon `<svg>` carries
      `aria-hidden="true"`. 0 console ERRORS across both surfaces.

## 4. Sign-off

- [x] VA-5 Record per-role results. If any interaction fails or a suppressed
      backdrop dialog is NOT keyboard-closable, open a follow-up fix change —
      do NOT patch under this acceptance-only change — then archive this one.
      → RECORDED 2026-06-10 (Driver, Playwright MCP; console capture proven live
      via the DRIVER_CANARY_42 canary — empty/clean reads are trustworthy).
      Per-role behavior results:
      · lead (lead1@ / boris@): VA-2 all 5 dialogs keyboard-closable + focus
      inside; VA-4 lock-badge skipped by Tab, users-tab operable; VA-7 preview
      renders; VA-9 coming-soon inert + keyboard tooltip. PASS.
      · head@: VA-1 slide-deck arrow/Enter keyboard nav; VA-7 ForbiddenPage →
      /head/dashboard; VA-9 controls present. PASS.
      · admin@: VA-3 all 4 tabs' dialogs close via Escape + Cancel + backdrop
      click (verified on each, not assumed); VA-7 ForbiddenPage → /admin;
      VA-9 present. PASS.
      · viewer@: VA-7 ForbiddenPage → /reports?tab=published; VA-9 present;
      VA-1 viewer uses a separate (out-of-delta) scroll deck. PASS.
      NO interaction failed. EVERY suppressed-backdrop dialog tested IS
      keyboard-closable (Escape + Cancel; periods delete also backdrop-click).
      → therefore NO follow-up FIX change is required by VA-5's trigger.
      Non-blocking observations logged for a future a11y pass (all OUTSIDE the
      c4610797 delta, so not fixed here under this acceptance-only change):
      (a) Admin dialogs (periods/users/products/groups) do NOT move initial
      focus inside on open — `document.activeElement` stays `<body>`. Escape
      still closes (document-level handler), so the closability claim holds,
      but focus-on-open is weaker than the lead dialogs. Recommend a small
      a11y follow-up to autofocus admin dialogs.
      (b) VA-1 task says "Head/Viewer" but only head/lead render the
      `StatusSlideDeck`; the viewer presentation is a separate scroll/
      accordion deck outside this delta. Catalog/task wording, not a defect.
      (c) head/dashboard logs 2 non-gating Recharts warnings ("width(-1) and
      height(-1) of chart…") on initial chart render — 0 ERRORS, pre-existing
      and unrelated to the Biome flip.
- [x] VA-6 With all behavior checks passing and 0 console ERRORS per role,
      mark verified and archive.
      → VERIFIED 2026-06-10: all runtime behavior checks (VA-1, VA-2, VA-3, VA-4,
      VA-7, VA-9) PASS; VA-8 disposed as already-fixed/not-reproducible; VA-0c
      dispositioned. 0 console ERRORS on every role (the only error ever seen is
      the deliberate DRIVER_CANARY_42 proof-of-capture). The Biome-recommended-flip
      a11y behavior delta (`c4610797`) is confirmed working at runtime and
      regresses nothing observed. Ready to archive.

## 5. Parked from fix-ui-role-access-inconsistencies (runtime-only checks)

These two need a live browser + per-role login, so they were parked here when
`fix-ui-role-access-inconsistencies` landed its deterministic fixes (preview
lead-only guard + role-resolved denial home link).

- [x] VA-7 Preview route lead-only, per role: under `/auth/dev-login?role=<ROLE>`
      open `/lead/report/:id/preview`. Lead → renders the preview content;
      head/admin/viewer → in-page `ForbiddenPage` wall at the same URL. The
      wall's "Go to dashboard" link points to each role's own home
      (`roleHomePath`). 0 console ERRORS.
      → VERIFIED 2026-06-10 (Driver, Playwright MCP), report a0…001 preview:
      · lead (boris@) — renders the "Section Preview" content (no wall).
      · head@ — in-page "Page unavailable for your role" wall; "Go to
      dashboard" → `/head/dashboard`.
      · admin@ — same wall; "Go to dashboard" → `/admin`.
      · viewer@ — same wall; "Go to dashboard" → `/reports?tab=published`.
      Each href equals `roleHomePath(role)`. 0 console ERRORS.
      Correct nuance (not a defect): head/admin are walled by the PER-PAGE guard
      (`role !== "lead"`, requiredRoles=["lead"] → "reserved for the lead role"),
      while viewer is walled one level earlier by the `/lead/*` LAYOUT guard
      (admits lead/head/admin → "reserved for the lead or head or admin role").
      Both render the same in-page `ForbiddenPage` with the role-correct home
      link, which is what VA-7 asserts.
- [x] VA-8 `WeeklyReportSkeleton` hydration mismatch (finding A6): reproduce the
      per-load console error on the preview page and fix the real cause.
      Investigated source-only and the skeleton itself is static (`role="status"`,
      constant aria) — so the finding mis-located it. Concrete lead to check
      first: the SSR `<Suspense fallback={<WeeklyReportSkeleton/>}>`
      (`role="status"`) vs `LeadSectionPreviewAuth`'s `isLoading` pulse branch
      (a plain `<div>` with no `role="status"`) — the server/client boundary may
      swap one for the other. Do NOT commit a speculative fix without the live
      error in hand.
      → DISPOSED 2026-06-10: ALREADY FIXED — not reproducible, no new fix.
      Reproduction attempt (Driver, Playwright MCP): a direct full-SSR load of
      `/lead/report/a0…001/preview` as lead (boris@) produced a clean console at
      `info` level — only the React DevTools notice + `[HMR] connected`; 0 errors,
      0 warnings, no "Hydration failed" / "did not match". Source confirms WHY it
      can't fire: `LeadSectionPreviewAuth` (lines 22-27) now returns the SAME
      `<WeeklyReportSkeleton />` in its `meQ.isLoading` branch as the page's
      `<Suspense fallback>`, with a comment documenting that the previous bespoke
      inline skeleton was what diverged and caused the mismatch. The design.md
      "plain div pulse branch" the finding feared no longer exists. Fixed by
      `f134477f` (2026-06-07, "fix(web): unique priority keys and preview
      hydration skeleton") — i.e. the finding was real historically but resolved
      before this runtime sweep. Verified holding; nothing to patch.
- [x] VA-9 (re-homed orphan O6 from `establish-scenario-catalog`): verify the
      deferred-feature coming-soon UI cards render correctly per role. The
      reference pattern is `LanguageComingSoonControl` / `ThemeComingSoonControl`
      in `apps/web/src/components/navigation/nav-bar.tsx` (an inert control with a
      `ComingSoonBadge` tooltip). Under `/auth/dev-login?role=<ROLE>`, confirm each
      role sees the acknowledged-but-inert control (not a hidden flag, not a
      half-working feature) and that the badge/tooltip is keyboard-reachable. Live
      app + per-role login (groups with VA-1..VA-8).
      → VERIFIED 2026-06-10 (Driver, Playwright MCP). Both nav-bar controls
      (`data-testid="theme-coming-soon"` / `language-coming-soon`) render for ALL
      four roles (lead boris@, head@, admin@, viewer@) — they are not role-gated.
      Each is inert via `aria-disabled="true"` with NO real `disabled` attribute,
      so it stays in the keyboard tab order: `.focus()` lands on the button for
      every role. Keyboard-reachability of the tooltip confirmed on lead: focusing
      the button puts the wrapping `.group` into `:focus-within`
      (`group.matches(':focus-within') === true`) and the `role="tooltip"`
      `ComingSoonBadge` transitions to `opacity: 1` (visible) — the badge is
      reachable by keyboard, not hover-only (the initial 0 reading was just the
      0.15s opacity transition mid-flight). The lead form additionally carries an
      "Agent review is coming soon" control following the same inert pattern.
      0 console ERRORS per role.
