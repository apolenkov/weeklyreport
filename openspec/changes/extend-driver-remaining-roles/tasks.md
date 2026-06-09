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

- [ ] 2.1 `head`: drive every catalog route via Playwright MCP, inject the
      console canary to prove capture is live, record anomalies to
      `e2e/sweep/.reports/head-driver.md`.
- [ ] 2.2 `admin`: same, to `admin-driver.md`.
- [ ] 2.3 `viewer`: same, to `viewer-driver.md`.

## 3. Verify and disposition

- [ ] 3.1 Run the `lead-driver-verify` adversarial workflow over each role's
      candidate findings; keep only confirmed bugs, dismiss seed/test artifacts.
- [ ] 3.2 Disposition each confirmed bug: fix-here (with a test + verify),
      defer-with-reason, or split to its own change. Record the decision per bug.

## 4. Close out

- [ ] 4.1 `openspec validate extend-driver-remaining-roles --strict` green.
- [ ] 4.2 Attach the per-role driver report summary (routes driven, canary
      detected, candidates → confirmed); archive.
