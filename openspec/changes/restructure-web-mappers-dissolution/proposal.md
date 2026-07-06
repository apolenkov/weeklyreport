## Why

Parent `restructure-directory-architecture` task 3.1, the trailing piece. The
`apps/web/src/lib/mappers/` tree (18 api/presentation mapper source files + an
`index.ts` barrel re-exporting 10 modules) is not a slice — it **dissolves** into
each consuming domain's `model/` dir per
`docs/architecture/mapping/web-lib-2026-07-02.md`. It was the last loose tree left
under `lib/`; every slice that owns a mapper now exists (created by the lead and
weekly-report dissolves), so it is unblocked.

## What Changes

- Dissolve `lib/mappers/` (behavior-neutral `git mv` + reroute) into three homes:
  - `features/admin/model/` — `admin`, `admin-form-inputs`, `admin-types`.
  - `features/dashboard/model/` — `dashboard`, `dashboard-counts`,
    `dashboard-escalations`, `dashboard-kpi`, `dashboard-leads`.
  - `features/report-sections/model/` — `item-status`, `lead-cross-author`,
    `lead-form`, `lead-history`, `lead-status`, `report-content`, `traffic-light`,
    `weekly-report`, `weekly-report-groupers`, `weekly-report-types` (the
    assembled-report translation core).
- **Mapping correction:** the doc routes `weekly-report{,-groupers,-types}` to a
  `features/weekly-report/model` that does not exist (the weekly-report tree
  dissolved into `report-sections`); its mappers join the assembled-report core in
  `features/report-sections/model` instead.
- Delete the `index.ts` barrel; split its 21 barrel consumers to import from the
  single `model/` file that actually owns each symbol (each barrel import resolved
  to one home — no cross-home symbol mixing). Reroute the 29 specific-file
  consumers and every relocated file's own relative imports.
- Rewire the 3 `vi.mock("../../../lib/mappers", …)` test doubles
  (`dashboard-page.test`, `print/[reportId]/page.test`,
  `report-shell/agent-review-coming-soon.test`) to the concrete `model/` module the
  component under test now imports.
- Repoint the `lib/mappers/lead-form.ts` `max-lines` exemption in
  `eslint.config.ts` to `features/report-sections/model/lead-form.ts`.
- Grandfather one cross-slice edge: the enforced `dashboard` slice's own mappers
  (`dashboard.ts`, `dashboard-leads.ts`) read `lead-status` + `traffic-light`, now
  in `report-sections/model`. The move turns this pre-existing coupling into a
  zone-5 `dashboard → report-sections` violation, so `report-sections` is added to
  the `dashboard` zone-5 allowlist (forbid-new, grandfather-existing — the
  enforcement flip removing it is the later boundaries slice #33).
- Remove the emptied `lib/mappers/` tree.
- **Behavior-neutral**: pure relocation + import reroute, zero logic change.

### Incidental fix — stale header comment on a relocated file

`features/report-sections/model/lead-cross-author.ts` carried a header comment
referencing now-dead paths (`components/lead/lead-form.tsx`,
`components/lead/mock-data.ts`, `lib/mappers`) and change-log slugs. Since the file
relocated here, its header was rewritten to drop the archaeology while keeping the
load-bearing rationale (the model layer must not import UI component types; the two
distinct query reads). Comment-only — no behavior change.

## Non-goals

- No mapper logic change. No `webSlices`/zone-5 enforcement flip (deferred
  boundaries slice, per the admin/lead/weekly-report dissolve precedent). Other
  pre-existing cross-slice mapper edges (e.g. `period` → `report-sections`) stay as
  flagged, unenforced edges.

## Impact

- Affected code: 28 relocated files (18 source + 10 tests) across
  `features/{admin,dashboard,report-sections}/model`; 50 rerouted consumer imports
  (21 barrel-split + 29 specific-file) + relocated files' own relative imports;
  3 rewired `vi.mock` doubles; `index.ts` deleted; 2 `eslint.config.ts` edits
  (1 exemption repointed + 1 zone-5 `except` added).
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/web-lib-2026-07-02.md` (with the weekly-report
  correction above).
- No load-bearing invariant touched.
- Verified: cold `tsc` 0 (5/5), full unit suite green (web 1567 + api + shared),
  full `pnpm lint` clean, and live-verified from source on `:3100` — `/`,
  `/reports`, `/head/dashboard`, `/admin`, `/lead/report/[id]`,
  `/head/report/[id]` all HTTP 200, `/print/[id]` 307 (PDF-worker auth gate), no
  module-resolution 500.
