## Why

Parent `restructure-directory-architecture` task 3.1 deliberately deferred web
slice-boundary enforcement: each dissolve (admin, lead, weekly-report, viewer,
mappers, …) relocated code WITHOUT registering the new slice in `webSlices`,
because `import-x/no-restricted-paths` `except` is slice-granular (it cannot
grandfather a single file, only a slice-pair). Registering a slice mid-dissolve
would have flagged lawful in-flight couplings. Now that every web domain has
settled into its `features/<slice>` home, this change completes the boundary: it
enforces ALL populated slices and grandfathers exactly the cross-slice edges that
exist today. It is the web analog of api slice 6's zone flip.

## What Changes

- Extend `webSlices` in `eslint.config.ts` from `[landing, analytics, dashboard]`
  to all 11 populated slices, adding: `admin`, `organization`, `pdf-export`,
  `period`, `report-sections`, `review`, `telemetry`, `viewer`.
- Grandfather every EXISTING cross-slice import edge (enumerated from the actual
  imports, so the allowlist is exactly the current coupling graph — minimal, no
  over-grant):
  - `admin` → organization, period, review
  - `dashboard` → review, report-sections (already present from the mappers slice)
  - `period` → admin, report-sections
  - `report-sections` → admin, pdf-export, period, review
  - `review` → admin, report-sections
  - `viewer` → pdf-export, period, report-sections
  - `analytics`, `landing`, `organization`, `pdf-export`, `telemetry` — no
    outgoing cross-slice edge, so no `except` entry (self only).
- Config-only: no source file moves, no runtime change.

## Non-goals

- No per-FILE enforcement. `except` grants the whole slice-pair, so a new import
  WITHIN an already-coupled pair (e.g. another `review → admin` edge) is still
  permitted; only reaching into a NEW sibling slice errors. Finer per-edge
  enforcement would need a different mechanism and is out of scope.
- No decoupling refactor — the grandfathered edges are recorded as-is, not removed.

## Impact

- Affected: `eslint.config.ts` only (`webSlices` array + `webSliceGrandfatheredExcept`
  map + the surrounding rationale comment).
- Parent: `restructure-directory-architecture` task 3.1 (its trailing enforcement
  piece — the code relocation itself finished with the mappers dissolution).
- No load-bearing invariant touched.
- Verified: `pnpm typecheck` 5/5, full `pnpm lint` clean, and a fail-closed proof
  — a synthetic forbidden edge (`analytics → admin`) errors with
  `import-x/no-restricted-paths`; a grandfathered edge (`viewer → report-sections`)
  passes.
