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

## Resolution

Fixes batched with the live-UAT findings, then re-tested + re-reviewed (fresh Codex session per
the codex-fresh-session-rereview rule). See git log for the fix commits.
