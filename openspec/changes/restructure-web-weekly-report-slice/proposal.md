## Why

Parent `restructure-directory-architecture` task 3.1. Like `lead`, the
`components/weekly-report/` tree (16 source files across a top level + a `review/`
subdir) is not a single slice — it **dissolves** into four canonical domains per
`docs/architecture/mapping/web-comp-weekly-report-2026-07-02.md`. It was blocked
on `features/report-sections/` existing (created by the lead dissolve); now unblocked.

## What Changes

- Dissolve `components/weekly-report/` (behavior-neutral `git mv` + reroute):
  - `features/report-sections/ui/` — `activity-status-strip`,
    `portfolio-overview-table`, `product-accordion`, `weekly-report-page`,
    `weekly-report-skeleton` (the assembled-report rendering core).
  - `features/pdf-export/ui/` — `export-pdf-button`.
  - `features/period/ui/` — `head-publish-lock-action`, `publish-lock-button`
    (own the `period.publish/reopen` mutations).
  - `features/review/ui/` — `record-comments`, `review-acknowledge-bar`,
    `review-mode-toggle`, `review-verdict-band`, `section-review-strip`,
    `section-verdict-control`, `submission-filter`; `features/review/model/` —
    `section-review-rows` (pure view-model mapper).
- Reroute the tree-wide consumers (head/viewer report shells, the reports and
  lead-preview routes, the dashboard page, the report-shell agent-review test).
- Repoint the two `eslint.config.ts` complexity/max-lines exemptions for
  `product-accordion.tsx` and `weekly-report-page.tsx` to `features/report-sections/ui/`.
- Grandfather one cross-slice edge: `dashboard-page.tsx` (the enforced `dashboard`
  slice) consumes `section-review-rows` + `SectionReviewStrip`, now in
  `features/review`. This pre-existing coupling was lawful while review lived in
  `components/`; the move turns it into a zone-5 `dashboard → review` violation, so
  a `dashboard: ["review"]` entry is added to the zone allowlist (forbid-new,
  grandfather-existing — the enforcement flip removing it is a later boundaries slice).
- Remove the emptied `components/weekly-report/` tree.
- **Behavior-neutral**: pure relocation + import reroute.

### Incidental fix — a latent max-lines from the lead dissolve

`features/period/ui/current-week-section.tsx` (relocated in the lead dissolve) sits
at 255 code lines because the longer FSD import paths forced two model imports to
wrap multi-line, tipping it 5 over the 250 limit — content unchanged from its
≤250 pre-move form. lint-staged does not fail on unfixable `max-lines`, so it
committed latent. This change adds the path to the `max-lines` exemption with that
rationale; a small extraction is a reasonable follow-up.

## Non-goals

- No component change. No `webSlices`/zone-5 enforcement flip (deferred boundaries
  slice, per the admin/lead dissolve precedent). The pre-existing cross-slice
  coupling `product-accordion` (report-sections) → `record-comments` (review)
  stays as a flagged, unenforced edge.

## Impact

- Affected code: 16 relocated files (+ tests/snapshots) across
  `features/{report-sections,pdf-export,period,review}`; ~12 rerouted consumers;
  3 `eslint.config.ts` exemption paths (2 repointed + 1 added).
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/web-comp-weekly-report-2026-07-02.md`.
- No load-bearing invariant touched.
- Verified: cold `tsc` 0, full web suite 1567, full web eslint clean, and
  live-verified from source — `/head/report/[id]`, `/reports/[id]`,
  `/lead/report/[id]` all HTTP 200, no module-resolution 500.
