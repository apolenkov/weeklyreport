## ADDED Requirements

### Requirement: Every populated web slice MUST be enforced in `webSlices`

Once the FSD-lite relocation has settled, EVERY populated `features/<slice>` MUST
appear in the `webSlices` array in `eslint.config.ts`, so that a slice reaching
into another slice's internals is a lint error unless the edge is an explicitly
grandfathered pre-existing coupling. The enforced set MUST cover all populated
slices — `admin`, `analytics`, `dashboard`, `landing`, `organization`,
`pdf-export`, `period`, `report-sections`, `review`, `telemetry`, `viewer` — and
the `webSliceGrandfatheredExcept` allowlist MUST contain exactly the cross-slice
edges that exist at flip time (no missing edge, no over-grant). Because `except` is
slice-granular, the allowlist forbids a slice from reaching into a NEW sibling but
permits further imports within a pair it already couples to.

#### Scenario: an unlisted cross-slice import is rejected

- **WHEN** a file under `features/analytics` imports from another slice's internals
  (e.g. `features/admin`) that is not in the grandfathered allowlist
- **THEN** `import-x/no-restricted-paths` reports a web-slice-boundary error

#### Scenario: a grandfathered cross-slice edge is permitted

- **WHEN** a file under `features/viewer` imports from `features/report-sections`
- **THEN** no boundary error is reported, because `report-sections` is in
  `viewer`'s grandfathered `except` list

#### Scenario: the enforced set is complete

- **WHEN** the boundary is flipped
- **THEN** every populated `features/<slice>` appears in `webSlices`
- **AND** no populated slice is left unenforced
