# SC-3 round 3 — convergence gap-critic (final)

<!--
  Round 3 of the loop-until-dry gap-critic. Verifies the three round-2 open
  items are now present + adequate, then sweeps the WHOLE catalog (API + UX,
  including the new ui-admin tier) for any genuinely NEW gap. Reports ONLY
  findings NOT already in _gaps.md / _gaps-round2.md / _ux-findings.md.

  Date: 2026-06-03, branch main. Reachability re-confirmed via codegraph +
  the live Playwright snapshot artifacts in .playwright-mcp/.
-->

## Verdict: CONVERGED

The three round-2 open items are now present and adequate. A fresh four-axis
sweep across the whole catalog (including the new `ui-admin.feature`) surfaced
zero new hard findings. Entry-point parity, enum-state parity, UX/API linkage,
and machine-checkability are all converged.

| Axis                                             | Result                |
| ------------------------------------------------ | --------------------- |
| 1. Entry-point parity (uncataloged entry points) | **0 new** — CONVERGED |
| 2. Enum-state parity (uncovered/dead values)     | **0 new** — CONVERGED |
| 3. UX/API linkage holes                          | **0 new** — CONVERGED |
| 4. Machine-checkability violations               | **0** — CONVERGED     |

---

## Round-2 open items — all three verified present and adequate

### A. `/admin` UX tier → `ui-admin.feature` (round-2 §3.1): ADEQUATE

- File exists: `e2e/catalog/ui-admin.feature` (326 lines, 22 scenarios).
- Covers all three routes (`/admin`, `/admin/products`, `/admin/settings`)
  across all four roles: 10 admin-granted structural/authz scenarios +
  9 denial scenarios (3 routes × head/lead/viewer) + tab/identity/products
  detail scenarios.
- Provenance verified: every scenario is annotated `src: dom`, and all 12
  cited snapshot artifacts physically exist in `.playwright-mcp/`
  (`{admin,head_admin,lead_admin,viewer_admin}_{root,products,settings}.yml`).
- Denial mechanism verified against code AND capture:
  `admin/layout.tsx` renders `ForbiddenPage` in-place (no redirect) for any
  non-admin role (`REQUIRED = ["admin"]`); the denied snapshots
  (`head_admin_products.yml` etc.) all show a `generic` element
  "Page unavailable for your role" + paragraph "This page is reserved for the
  admin role. …" with a `/head/dashboard` link. The feature's "in-page wall,
  URL unchanged, NOT a heading" framing matches the rendered DOM exactly
  (`CardTitle` is a `generic`, not an `h1`).
- Cross-refs to `admin.feature` / `admin-ops.feature` are present per scenario
  (saveUser, saveProject, updateSettings, stage assignment, reopen badge).
- The CRITICAL ANOMALY header (existing specs drive `/admin` with `headPage`
  while live DOM denies head) is a useful, code-confirmed catalog note.

### B. WorkingDays scenarios (round-2 §2.2): ADEQUATE

- `reports-period.feature:491-539` adds three scenarios — one per value
  (`mon-fri` → Monday, `mon-sat` → Saturday, `mon-sun` → Saturday) — each
  asserting an exact `computeDeadline` result with explicit anchor dates and
  the UTC equivalent. The mon-fri vs mon-sun contrast demonstrates the policy
  genuinely changes the deadline.
- Reachability re-confirmed via codegraph: `computeDeadline` has exactly the
  two callers the fill cites — `createPeriodManual`
  (period-admin.service.ts:206) and `runOnce` (period-creator.scheduler.ts:61).
  No third call site; the wired value is genuinely consumed.
- Coverage annotations point to real `business-date.test.ts` cases and are
  honest where weaker (`mon-sat` is noted as covered only at the
  `addBusinessDays` layer, no `computeDeadline+mon-sat` unit test).

### C. `PdfExportStatus.processing` dead-marker (round-2 §2.1): ADEQUATE

- `misc.feature:175-188` records `processing` as a dead enum value with an
  explicit audit scenario: mapper declares it both directions; service writes
  only `queued`/`completed`; processor calls only `markExportFailed` /
  `markExportCompleted`; value unreachable in production.
- Reachability re-confirmed: `codegraph_search("markExportProcessing")`
  returns nothing — there is no intermediate-transition writer. Same class as
  `CarryOverStatus.failed`, correctly framed as ledger-only.

---

## Fresh four-axis sweep — no new findings

### Axis 1 — Entry-point parity: CONVERGED (0 new)

The `/admin` route tree (page.tsx + products/settings alias pages + layout)
is now mirrored at the UX tier; its API-side procedures were already cataloged
in `admin.feature`. No code-derived entry point (tRPC / REST / BullMQ / cron /
Next route / UI route) lacks a catalog scenario. Round-1 and round-2 already
closed this axis; round-3 adds no new uncataloged surface.

### Axis 2 — Enum-state parity: CONVERGED (0 new)

All 17 enums were exhaustively walked in rounds 1–2. The two round-2 enum
findings (PdfExportStatus.processing dead; WorkingDays values uncovered) are
now both reflected in the catalog. No previously-missed value surfaced.

### Axis 3 — UX/API linkage: CONVERGED (0 new)

The single round-2 one-sided hole (`/admin` had API coverage, no UX coverage)
is closed by `ui-admin.feature`. The round-2 "UX tier drives no mutations"
scope boundary is unchanged and remains a deliberate boundary, not a hole. No
new one-sided coverage surfaced.

### Axis 4 — Machine-checkability: CONVERGED (0 violations)

Scanned every `Then` in the new `ui-admin.feature` (22 scenarios): all are
machine-checkable — exact final URLs, exact heading text + level, exact
combobox option lists, exact button accessible names, `consoleErrorCount is 0`,
exact tab-list contents. A vague-adverb scan (`correctly`, `properly`,
`appropriately`, `as expected`, `gracefully`, …) over the file returns zero
hits. No violators.

---

## Observations (NOT new gaps — recorded for completeness)

- **`_ux-matrix.md` is stale at 17 routes.** The UX surface is now 20 routes
  (the three `/admin/*` routes were added via `ui-admin.feature` but the
  role×route matrix table was not extended). This is bookkeeping staleness in
  a derived doc, not a behavioral, linkage, or coverage gap. Optional tidy:
  append the three admin rows to `_ux-matrix.md`.
- **`ui-admin.feature` denied-paragraph assertion is a substring.** Scenarios
  assert the paragraph "This page is reserved for the admin role." while the
  rendered `<p>` continues "… Switch role from the dev role switcher …". The
  step says "is visible" (substring-of-exact-string — machine-checkable), not
  "reads exactly", so this is a wording nit, not a checkability violation.
- **All 22 `ui-admin.feature` scenarios are `covered: none ✗`.** This is the
  same api-only-with-no-test class as the existing 177 items in `_gaps.md` §6
  (now ~199 with the UX tier) — an automation backlog, not a new gap.
- **"Go to dashboard" link is `/head/dashboard` for all three denied roles.**
  Confirmed in the denied snapshots; already flagged as a possible seam in the
  `ui-admin.feature` header note. Not a behavioral gap (the link target is a
  cosmetic fallback, not an authz boundary).

---

## Bottom line

- NEW uncataloged entry points: **0** (CONVERGED).
- NEW uncovered/dead enum states: **0** (CONVERGED).
- NEW UX/API linkage holes: **0** (CONVERGED).
- Machine-checkability violations: **0** (CONVERGED).

The three round-2 fills (`ui-admin.feature`, WorkingDays scenarios,
PdfExportStatus.processing dead-marker) are present, code-grounded, and
adequate. The catalog has reached convergence across all four axes.

Verdict: **CONVERGED**.
