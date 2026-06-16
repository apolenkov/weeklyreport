# Code Review Log — fix-report-surface-integrity (implementation)

Adversarial Codex code review of the IMPLEMENTATION diff (`main..HEAD`), run autonomously
2026-06-16. Plan was already Codex-APPROVED (7 rounds, see PLAN-REVIEW-LOG.md); this reviews
the shipped code. Round 1 = REVISE.

## Round 1 — VERDICT: REVISE

PASS (with file evidence): W11 completeness reversal (strict predicate in mapper + bridge,
counter reads raw, chip reads raw emptiness); W6 floor parity (mapper preserves raw; surfaces
consume product worstStatus); W7/W8 escalations (one shared builder, no unscoped prisma.project
query, "No stage set" in web mapper); W2 authz (leadershipProcedure = head/admin/viewer).

### BLOCKING

1. **Lead sees the active Export-PDF button** — `weekly-report-page.tsx:209` renders the live
   `ExportPdfButton` (calls `pdfExport.request`, `export-pdf-button.tsx:97`) for any logged-in
   role; `canExportPdf` does not exclude lead. A lead reaches `WeeklyReportPage` via the lead
   preview surface (`/lead/report/[id]/preview` -> `LeadSectionPreviewAuth`), so a lead gets an
   Export button that the backend now FORBIDs. Fix: gate `canExportPdf` to head/admin/viewer;
   render the inert lead ComingSoon control on the lead surface. (Stale test asserts the old
   behavior: `weekly-report-page.test.tsx:563`.)
2. **`/print` lead ownership not enforced** — `print/[reportId]/page.tsx:51` always redirects an
   authenticated lead human to `/lead/report` without checking whether `[reportId]` is theirs.
   Spec requires own-report/preview, else FORBIDDEN. Fix: resolve lead ownership server-side.

### MINOR

3. **`/print` human redirect is 308 (cacheable cross-role)** — `print/[reportId]/page.tsx:67`
   uses `permanentRedirect` for a session-dependent destination; a cache/proxy could serve one
   role's redirect to another. Fix: use a temporary (307) redirect for the human branch; keep
   308 only for the static `/present` -> `?mode=slides`.
4. **Stale spec-delta symbol name** — `specs/report-badge-resolution/spec.md:11` and
   `specs/risk-stage-integrity/spec.md:10` still name the removed `buildEscalationsFromSnapshotSections`;
   rename to `buildEscalationsFromReadSections`.

## Round 2 — VERDICT: REVISE (all CODE invariants PASS; spec/comment drift only)

Codex re-verified round 1's fixes resolved and re-checked every invariant: W11, W6, W7/W8, W2
authz, W2 routing, Export UI — all PASS with file evidence. Findings were doc drift:

1. [BLOCKING] status-risk-unification spec still required the mapper to floor → corrected to
   render-time floor + mapper preserves raw + `coveredByOwnRisk`.
2. [BLOCKING] report-routing spec still said /print human = 308 + lead FORBIDDEN → corrected to
   307 temporary + lead own-path.
3. [MINOR] stale "308" comment in `reports/[reportId]/page.tsx` → 307.

## Round 3 — VERDICT: REVISE (spec drift only)

1. [BLOCKING] a status-risk-unification _scenario_ still described mapper flooring → rewritten.
2. [MINOR] two specs named the removed live `buildEscalations` → renamed to the single shared
   `buildEscalationsFromReadSections`. Followed by an exhaustive spec sweep.

## Round 4 — VERDICT: REVISE (cosmetic only) — code APPROVED in substance

Codex explicitly PASSED all six invariant categories (W11, W6 deviation, W7/W8, W2 authz, W2
routing, Export UI) with file:line evidence. Two cosmetic findings:

1. [MINOR] `export-pdf-button.tsx` comment said "head-only" → corrected to leadership-scoped
   (head/admin/viewer; lead FORBIDDEN). FIXED.
2. [MINOR] `role-coverage-gate` requirement heading says "Eight" while its body says "9". This is
   a PRE-EXISTING inconsistency in the main spec (`openspec/specs/role-coverage-gate/spec.md:54`
   vs :56), inherited by the delta — NOT introduced by this change. Renaming the heading in the
   delta alone would break MODIFIED-requirement name matching against the main spec (needs a
   RENAMED-requirement, out of scope). Left as-is; flagged for a separate cleanup.

## Resolution — CONVERGED

All four rounds confirmed the CODE is correct; every invariant PASSED from round 2 onward. The
REVISE verdicts after round 1 were spec-delta + comment drift, all fixed except the one
pre-existing main-spec heading nit (documented above). Loop stopped at round 4 (diminishing
returns on cosmetics). Full gate green; `openspec validate --strict` green. Ready for PR.
Each round was a FRESH Codex session (no resume) per the codex-fresh-session-rereview rule.
