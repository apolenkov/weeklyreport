# Tasks

## Decision (human)

- [x] T1: Decide intent for `/lead/report/:id/preview` — lead-only (add guard) or
      intentionally cross-role (document it). **DECIDED: lead-only.** Denial
      pattern (T5) also decided: in-page wall everywhere.

## Fixes

- [x] T2: Lead-only per-page guard on the preview page (`preview/page.tsx`):
      `getServerSession()`, `role !== "lead"` → in-page `ForbiddenPage`. The
      parent `/lead/*` layout admits lead/head/admin, so this page walls
      head/admin (and re-walls viewer harmlessly). Matches the wall pattern (T5).
- [x] T3: `WeeklyReportSkeleton` hydration mismatch — investigated + parked (not
      fixed here). Source-only
      investigation shows the skeleton is static (`role="status"`, constant aria),
      so the finding mis-located the cause; the real defect can only be reproduced
      with a live browser. **Parked into `verify-a11y-recommended-flip` VA-8** with
      a concrete lead (SSR Suspense fallback vs `LeadSectionPreviewAuth` isLoading
      branch). No speculative fix committed.
- [x] T4: `ForbiddenPage` home link is now caller-resolved — added a `homeHref`
      prop; all 5 gate layouts (admin, head, head/report, lead, reports) and the
      preview guard pass `session ? roleHomePath(session.role) : "/"`. Component
      stays role-agnostic (no role prop). Updated `forbidden-page.test.tsx`.
- [x] T5: Single denial pattern = in-page wall. VERIFIED already satisfied: all 5
      role gates render `ForbiddenPage` at the same URL; a redirect grep over
      `(app)/` found only query-param normalization redirects, zero role-denial
      redirects. The premise "lead/admin are redirected away" did not match the
      code. The T2 preview guard closes the one remaining inconsistency.

## Verification

- [x] T6: Per-role runtime sweep (Lead/Head/Admin/Viewer via `/auth/dev-login`) on
      the preview route + 0 console ERRORS — parked (needs a live browser).
      **Parked into
      `verify-a11y-recommended-flip` VA-7.** Unit-level proof landed instead:
      `web typecheck` green (all `ForbiddenPage` call sites updated),
      `forbidden-page` / `role-visibility` / `nav-bar` tests pass (49).
- [x] T7: `openspec validate fix-ui-role-access-inconsistencies --strict` passes.

## Notes

- Evidence: findings A3 (preview no-guard) + 3b (hardcoded wall link), both
  code-verified this session; A6 (hydration) re-scoped — see T3.
- The delta spec was rewritten to the verified invariant (uniform in-page wall +
  lead-only preview + role-resolved home), dropping the un-runtime-verified
  "redirected away" / "hydration fixed" framing.
- Re-cover the runtime behavior via agent-driven testing after VA-7/VA-8 land.
