# Tasks

## Decision (human)

- [ ] T1: Decide intent for `/lead/report/:id/preview` — lead-only (add guard) or
      intentionally cross-role (document it). All other tasks depend on this.

## Fixes

- [ ] T2: If lead-only, add a per-page role guard matching the `/lead/*` siblings
      (redirect non-leads) in the preview page or `LeadSectionPreviewAuth`.
- [ ] T3: Fix the `WeeklyReportSkeleton` hydration mismatch (server/client
      role/aria-busy/aria-label) so the page logs 0 console errors for all roles.
- [ ] T4: Replace the hardcoded `/head/dashboard` in the access wall with a
      role-resolved home via the `role-home` helper.
- [ ] T5: Pick ONE denial pattern (in-page wall vs redirect) and apply uniformly
      across `/head/*` and `/lead/*`.

## Verification

- [ ] T6: Under each role (Lead/Head/Admin/Viewer) via `/auth/dev-login`, confirm
      the chosen behavior on the preview route and 0 console ERRORS on that page.
- [ ] T7: `openspec validate fix-ui-role-access-inconsistencies --strict` passes.

## Notes

- Evidence: `/tmp/catalog-findings-backup/_ux-findings.md` (A3 + A6 + wall link +
  A7/A8 denial patterns), code-verified this session.
- The old Playwright e2e specs that asserted this were removed on
  `chore/wipe-e2e-tests`; re-cover via agent-driven testing after the fix lands.
