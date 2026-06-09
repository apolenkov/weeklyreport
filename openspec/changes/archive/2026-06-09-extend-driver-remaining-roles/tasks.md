# Tasks

Gates after any code step (only if a confirmed bug is fixed):
`pnpm typecheck && pnpm lint && pnpm test`. The Driver run itself produces
reports, not code.

> **Origin.** Split out of `behavioral-ui-regression-gate` task 5.1 (the Driver
> half for `head`/`admin`/`viewer`). The catalogs for all four roles already
> exist; the drive-prompt and verify workflow already exist and were proven on
> `lead`. This change only executes them.

## 1. Prerequisites (reuse, do not re-derive)

- [~] 1.1 Confirm the live app is reachable under dev-auth (web + API) and the
  Playwright MCP browser can log in per role. Reuse the sweep's dev-auth
  path; do NOT author a new login.
  → APP SIDE DONE 2026-06-09: sweep target servers run as native processes on
  web :3100 / API :3101 (start via `.scratch/start-sweep-servers.sh`).
  Verified: API health 200, web 200, dev-login GET (lead) → 302 (cookie set).
  REMAINING: confirm the Playwright MCP browser itself logs in per role — the
  fresh driver session's first step (see `.scratch/handoff-2026-06-09-driver-fanout.md`).
- [x] 1.2 Confirm the artifacts are intact: `e2e/sweep/driver/drive-prompt.md`,
      `e2e/sweep/driver/README.md`, and the verify workflow — now archived at
      `openspec/changes/archive/2026-06-08-behavioral-ui-regression-gate/workflow/lead-driver-verify.workflow.mjs`
      (relocate it into this change's `workflow/` dir before use, since it moved
      with the parent change's archive).
      → DONE 2026-06-09: drive-prompt.md + README.md confirmed present; verify
      workflow copied to
      `openspec/changes/extend-driver-remaining-roles/workflow/lead-driver-verify.workflow.mjs`
      (copied, not moved — the parent archive stays intact).

## 2. Drive each role (one at a time)

- [x] 2.1 `head`: drive every catalog route via Playwright MCP, inject the
      console canary to prove capture is live, record anomalies to
      `e2e/sweep/.reports/head-driver.md`.
      → DONE 2026-06-09: 14/14 routes, canary detected, 1 candidate (low/flow).
- [x] 2.2 `admin`: same, to `admin-driver.md`.
      → DONE 2026-06-09: 18/18 routes, canary detected, 2 candidates (low/render).
- [x] 2.3 `viewer`: same, to `viewer-driver.md`.
      → DONE 2026-06-09: 6/6 routes, canary detected, 3 candidates (1 high/flow
      Export-PDF 403, 2 low/render).

## 3. Verify and disposition

- [x] 3.1 Run the `lead-driver-verify` adversarial workflow over each role's
      candidate findings; keep only confirmed bugs, dismiss seed/test artifacts.
      → DONE 2026-06-09. The verify workflow was generalized to take
      `{ role, catalog, candidates }` (was lead-only) so each skeptic reads the
      matching catalog; run once per role. 6 candidates → verdicts below. The
      main session independently re-verified every verdict against source +
      live browser (the skeptic is itself a false-positive/false-negative
      source): it CONFIRMED the 403 the skeptic had dismissed, and REVERSED the
      skeptic's "real-bug" call on the head card-click.
- [x] 3.2 Disposition each confirmed bug: fix-here (with a test + verify),
      defer-with-reason, or split to its own change. Record the decision per bug.

  Disposition record (6 candidates):

  - **viewer Export-PDF 403 (high) — FIXED here.** Skeptic dismissed it as
    expected authz; that was wrong. Empirically reproduced: the read-only
    `/reports/[reportId]` route embeds the editorial `WeeklyReportPage`, whose
    async `ExportPdfButton` rendered for every role. Its `pdfExport.request`
    job is `headProcedure`-gated (head/admin), so a viewer/lead saw an enabled
    button that 403'd on click. Fix: gate the button with `canMutatePeriod`
    (= head/admin, the exact server authz) in
    `apps/web/src/components/weekly-report/weekly-report-page.tsx`. The
    read-only route still offers the plain `/print/[reportId]` link for all
    roles. Verified in-browser both directions; tests added
    (`weekly-report-page.test.tsx` role-gating block + strengthened the
    existing viewer read-only test). `/present` carries no action bar — no leak.
  - **admin `/reports/trends` Chart 3 empty (low) — FIXED here.** Hardcoded
    `PERIOD_A`/`PERIOD_B` April dates went stale when the seed moved to
    runtime-relative period dates → permanent empty comparison. Fix: derive the
    two most recent periods from the loaded `trafficLightHistory.periods`
    (`apps/web/src/lib/analytics-periods.ts` + `reports/trends/page.tsx`,
    comparison query `enabled` only when ≥2 periods). Unit test added.
  - **viewer history sidebar stats 0/N (low) — FIXED here.** The shared sidebar
    counted only `status === "submitted"`; compiled (head/viewer) entries carry
    `published`/`archived`, so every compiled stat read 0. Fix: widen the
    completion check to include `published`/`archived`
    (`lead-history-sidebar.tsx`). Safe for the lead personal view (those
    statuses never occur there). Component test added.
  - **head card-click → read-only vs editorial (low) — DEFERRED, product call.**
    Skeptic called it a real bug (head should reach `/lead/report` → editorial).
    Reversed on review: the href comes from the SHARED `mapCompiledHistoryEntries`
    mapper, which the viewer relies on to reach the read-only `/reports/[id]`
    viewer — a blanket change would break the viewer (and route the head into
    editorial actions on already-published reports). From the published-reports
    ARCHIVE, read-only is defensible product behavior; the catalog's
    `head-click-report-card` `then` may simply be over-specified. Whether to
    keep read-only (correct the catalog) or reach editorial (add a role-aware
    href) is a product decision — NOT resolved by editing the oracle to match
    the code (that would silence the only signal that flagged the divergence).
    Left for the user; catalog untouched.
  - **admin dashboard "no Send Reminder bar" (low) — DISMISSED.** Driver
    misread: the `scheduled` period is invisible to the dashboard API
    (`getActiveReportId` selects only open/reopened/published), so the
    empty-state is correct.
  - **viewer period-nav single option (low) — DISMISSED.** Expected: the
    period array is intentionally single-element (documented "future plans"),
    and the intent's `then` does not contract period navigation.

## 4. Close out

- [x] 4.1 `openspec validate extend-driver-remaining-roles --strict` green.
      → DONE 2026-06-09: "Change 'extend-driver-remaining-roles' is valid".
- [x] 4.2 Attach the per-role driver report summary (routes driven, canary
      detected, candidates → confirmed); archive.
      → Per-role reports in `e2e/sweep/.reports/{head,admin,viewer}-driver.md`
      (each carries a disposition footer). Summary:
      head 14/14 · canary ✓ · 1 candidate → 0 confirmed (1 deferred product call);
      admin 18/18 · canary ✓ · 2 candidates → 1 confirmed+fixed, 1 dismissed;
      viewer 6/6 · canary ✓ · 3 candidates → 2 confirmed+fixed, 1 dismissed.
      Net: 3 real bugs fixed (with tests, gate green), 1 deferred, 2 dismissed.
