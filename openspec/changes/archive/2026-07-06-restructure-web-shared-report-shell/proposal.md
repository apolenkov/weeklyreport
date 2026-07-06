## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic end-to-end with the
`landing` pilot slice. Task 3.1 of that change mandates that **each remaining web
domain lands its own OpenSpec change**; `analytics`, the shared `navigation`
chrome, and `dashboard` already did. This child slice relocates the
**report-shell UI primitives** — the collapsible section shell, toolbar frame,
segmented toggles, icon buttons, badges and the small idiom helpers that dress
every report surface.

Unlike a domain slice, report-shell has no single owning feature: its components
are consumed across lead, head, viewer, weekly-report, slides and even the
dashboard slice (`accordion-section`, `report-toolbar`, `segmented-toggle`,
`save-now-button`, `rotating-chevron`, `use-report-shell-url-state`, …). None
carries feature-specific state or logic — they are business-agnostic presentational
primitives. That makes their home `shared/ui/`, **not** `features/<domain>/ui/`.
The files still live in the legacy flat `apps/web/src/components/report-shell/`
tree, so their placement is guesswork and no lint zone guards them. The per-file
placement is researched and fixed in
`docs/architecture/mapping/web-comp-report-shell-2026-07-02.md` (source catalog
`docs/architecture/catalog/web-comp-report-shell-2026-07-02.md`), with
`TARGET-STRUCTURE-2026-07-02.md` as the tie-breaker (which marks
`report-shell`/`common`/`ui` primitives as the migration-slice-3 `shared/` line
item).

**Count reconciliation.** The catalog (2026-07-02) enumerated 11 files. Commit
`82eb5a76` ("shared idioms") later added `rotating-chevron.tsx`,
`use-report-shell-url-state.ts`, and the `card-surface-guard.test.ts` guard test;
`b031936d` added the `toolbar-control-token.test.ts` guard test to the same
folder. The mapping's summary prescribes a **flat rename of the parent
directory** ("no file is split or renamed individually"), and the sibling
`navigation` spec established that the legacy folder MUST NOT survive. This change
therefore flat-renames the **whole current folder** — the 11 mapped files plus the
post-catalog additions — so nothing is orphaned in a surviving legacy directory.

## What Changes

- Relocate the entire `apps/web/src/components/report-shell/` folder to
  `apps/web/src/shared/ui/report-shell/`, filenames unchanged, per the
  authoritative mapping (every row: `Layer` = shared/ui, `Domain` =
  business-agnostic). Source files moved:
  - The 11 mapped primitives: `accordion-section.tsx`,
    `agent-review-coming-soon.tsx`, `archive-toggle.tsx`, `lock-badge.tsx`,
    `meta-row.tsx`, `report-toolbar.tsx`, `save-now-button.tsx`,
    `scope-toggle.tsx`, `segmented-toggle.tsx`, `toolbar-icon-button.tsx`,
    `view-mode-toggle.tsx`.
  - The post-catalog additions from `82eb5a76`: `rotating-chevron.tsx` and
    `use-report-shell-url-state.ts`.
- Move every co-located test and the `__snapshots__/` directory alongside their
  files, preserving the relative layout: the per-component `*.test.tsx`
  (`agent-review-coming-soon`, `archive-toggle`, `lock-badge`, `report-toolbar`,
  `save-now-button`, `scope-toggle`, `toolbar-icon-button`), the multi-component
  `report-shell.test.tsx`, and the two `@vitest-environment node` guard tests
  (`card-surface-guard.test.ts`, `toolbar-control-token.test.ts`). The guard tests
  resolve their scan roots from `process.cwd()` (= `apps/web`), so they are
  location-independent — no import edits needed.
- Fix the moved files' upward relative imports by **recomputing from the new
  location** `src/shared/ui/report-shell/`, not by blindly adding one `../`. The
  folder sits one level deeper than the legacy tree AND under a different top
  segment, so an import to anything under `src/` starts `../../../` then the
  target's `src`-relative path. Only two source files have upward imports and they
  move asymmetrically:
  - `lock-badge.tsx`: `../ui/sdlc-tooltip` → `../../../components/ui/sdlc-tooltip`
    (target lives at `src/components/ui/`, so the path must route back through
    `components/` — it does NOT become `shared/ui/sdlc-tooltip`).
  - `save-now-button.tsx`: `../../hooks/use-lead-form-autosave` →
    `../../../hooks/use-lead-form-autosave` (target is top-level `src/hooks/`).
  - Intra-folder `./`-relative imports (e.g. `scope-toggle` → `./segmented-toggle`,
    tests → `./accordion-section`) stay valid unchanged.
- Reroute every repo-wide consumer of the moved paths to
  `shared/ui/report-shell/*` directly. No barrel is added:
  `TARGET-STRUCTURE-2026-07-02.md` marks web barrels OPTIONAL and prescribes none
  for `shared/`; consumers express the boundary through the deep import, matching
  the `navigation` slice. Consumers reach the folder today via `../report-shell/*`,
  `../../report-shell/*`, and (from `features/dashboard/ui/`)
  `../../../components/report-shell/*`; each recomputes to the new path.
- **eslint exemptions:** grep confirms `eslint.config.ts` pins NO report-shell
  file (0 matches) — none of these primitives exceeds a size/complexity threshold —
  so there is no exemption path to update, unlike `navigation` (2) and `dashboard`
  (5). The `webSlices` array is likewise **unchanged**: `shared/` is not a feature
  slice and no cross-slice zone governs it.
- **Behavior-neutral**: no component logic, props, or rendered output changes;
  this is a pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- **No re-home of `use-report-shell-url-state.ts` into `shared/hooks/`.** Axis-2 of
  the target tree places generic hooks in `shared/hooks/`, not `shared/ui/`. For
  this behavior-neutral pass the hook travels with its folder (flat rename) and
  lands in `shared/ui/report-shell/`; re-homing it to `shared/hooks/` is a possible
  follow-up, deferred exactly as `dashboard` deferred its mock-data type/fixture
  split. The two `node`-env guard tests are likewise kept in place (cwd-relative,
  location-independent) rather than relocated to a shared test-support home.
- No relocation of the `components/ui/*` / `hooks/*` helpers report-shell depends
  on — they keep their current homes this pass; report-shell imports them at their
  real paths.
- No new `features/<domain>` slice: report-shell chrome has no single owning
  domain, so it graduates to `shared/ui/` rather than any feature slice; the
  `webSlices` boundary list does not change.
- No change to the boundary-zone mechanism itself (owned by the parent change).

## Impact

- Affected code: `apps/web/src/shared/ui/report-shell/**` (new), the deleted
  `apps/web/src/components/report-shell/` tree, and every consumer's import path
  across `app/`, `components/head`, `components/lead`, `components/viewer`,
  `components/weekly-report`, `components/slides`, and `features/dashboard/ui`
  (relative-path reroute only). `eslint.config.ts` is NOT edited (no report-shell
  exemption, `webSlices` unchanged).
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's fourth web child slice (after `analytics`, `navigation`, `dashboard`).
  Mapping: `docs/architecture/mapping/web-comp-report-shell-2026-07-02.md`.
- No load-bearing invariant touched (report-shell is presentational chrome; no
  write path, no tRPC middleware chain rewired).
