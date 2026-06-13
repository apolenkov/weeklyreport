# Tasks — Head Toolbar Parity

Decisions D1-D6: `design.md`. Survey evidence: `proposal.md`.
Ordering: runs AFTER `defer-versions-coming-soon` (D6) — verify the
version nav is already behind ComingSoon before starting.

## 1. Shared primitive (D3)

- [x] 1.1 Add `report-shell/toolbar-icon-button.tsx`: 32×32 circular
      button extracted from `SaveNowButton` styling; required
      `aria-label`; `title` defaults to the aria-label; size constant
      lives only here.
- [x] 1.2 Refactor `save-now-button.tsx` to consume the primitive —
      zero behavior change (keep all four icon states and tests
      green; structural only, see parallel `save-now-pending-indicator`).
- [x] 1.3 Unit test: primitive renders aria-label + title, 32px class,
      disabled state.

## 2. Icon conversions (D1, D4, D5)

- [x] 2.1 `archive-toggle.tsx` → `ToolbarIconButton`-based switch:
      keep `role="switch"`, `aria-checked`, checked styling; archived
      count as a visible compact badge; aria-label/title unchanged.
- [x] 2.2 Update `archive-toggle.test.tsx` to the new contract (icon
      button, switch semantics, visible count).
- [x] 2.3 `fill-from-button.tsx` trigger row → two 32px icon buttons
      (copy = fill from most recent, caret = open picker); panel and
      confirm flow untouched.
- [x] 2.4 Update `fill-from-button.test.tsx` to the new triggers
      (aria-labels, identical fill/picker behavior).

## 3. Container + arrangement port (D2)

- [x] 3.1 `weekly-report-page.tsx`: replace the bespoke gradient
      "Context shell" (line ~350) with `ReportToolbar`
      (periodNavigator = `HeadPeriodNavigator`, center slot =
      department label via shared `ReportToolbarCenterLabel`).
- [x] 3.2 Add the suppression prop (default on) and use it from
      `head-report-shell.tsx` so `/head/report/[id]` shows exactly one
      toolbar; move the department label into the shell toolbar.
      (Review fix 2026-06-11: boolean suppression replaced by a
      `toolbar` ReactNode slot — see design.md D2 amendment.)
- [x] 3.3 `head-report-shell.tsx`: reorder to the lead arrangement —
      page header row first, single pill toolbar below; keep the
      scope/view-mode/Present/Print group's existing labels, family
      styling, and placeholder position (`head-toolbar-semantics`).
      (Review fix 2026-06-11: the first pass only put the toolbar
      below the shell's utility action row; the real page header still
      rendered below it. Now WeeklyReportPage renders the shell's
      toolbar via the slot, below the actual h1 header row.)
- [x] 3.4 Verify standalone consumers (`/head/report` bare,
      `/reports/[reportId]`, lead preview, present client) render the
      pill container with default props — adjust tests, no behavior
      change. (All four call sites consume `WeeklyReportPage` without
      `contextToolbar`, so the default-pill test in
      `weekly-report-page.test.tsx` covers them.)

## 4. Tests + verification

- [x] 4.1 Parity pin test: lead form and head shell both render the
      shared `ReportToolbar`; head review page contains exactly one
      period toolbar. (Pins: `lead-form.test.tsx`,
      `head-report-shell.test.tsx` — single toolbar, suppression
      pass-through, toolbar below the header row;
      `weekly-report-page.test.tsx` — suppression removes the bar.)
- [x] 4.2 Update `weekly-report-page.test.tsx` + affected head/lead
      snapshots deliberately (named diffs, no blind `-u`); do NOT
      stage or revert the pre-existing dirty
      `product-accordion.test.tsx.snap`. (Full web suite green with
      NO snapshot churn — no committed snapshot covers the converted
      controls; the dirty product-accordion snap was left untouched.)
- [x] 4.3 UI-string check on touched files:
      `grep -nE '[а-яА-Я]'` — matches only in data/comments/tests.
      (Zero Cyrillic matches in all 7 touched production files.)
- [x] 4.4 Gates: `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` — record results here. (2026-06-11: typecheck PASS,
      lint PASS — ESLint no issues, test PASS — web 1028 tests,
      build PASS. Prettier re-wrapped 2 touched files before commit.)
- [x] 4.5 Live check on :3000 (lead + head + viewer report routes):
      one pill toolbar per page, icon buttons show tooltips, archive
      count visible, fill-from and save flows behave identically.
      (2026-06-11 via Playwright: lead `/lead/report`, head
      `/head/report/[id]`, viewer `/reports/[id]`, lead preview — each
      renders exactly ONE `ReportToolbar`; head toolbar sits below the
      header action row with the department label centered; archive
      switch is 32×32 with visible count badge and working
      `aria-checked` flip; fill triggers are 32×32 with
      aria-label+title, disabled on the submitted/read-only section
      exactly as before. Live finding fixed during the check: flex
      squeeze shrank the icon button below 32px — added `shrink-0` to
      the primitive. Fresh page loads show zero console errors.)
