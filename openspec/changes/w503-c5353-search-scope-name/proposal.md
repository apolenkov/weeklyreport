# Proposal

## Why

The shared search control always announces itself as "Search Reports", while the
same component serves three result scopes. On the products surface
(`products-tab.tsx`) and in the head report history it runs with `scope="all"`,
which can return product hits, and its visible placeholder there is "Any product
or report…". A screen-reader user therefore hears a name that omits products, and
a caller-supplied placeholder never reaches the accessible name. No active
specification owns the search control's accessible name.

Backlog: TASK-503.80 (clause C5353). Root decision 2026-10-15: derive the
accessible name from the actual scope; `all` is "Search reports and products",
report-scoped search is "Search reports"; contract and source RED first, no
native AT claim.

## What Changes

- Derive the combobox accessible name from the effective scope: `all` becomes
  "Search reports and products"; the report scopes `mine` and `published` become
  "Search reports".
- Keep the visible placeholder, `name="search"`, ARIA popup relationships,
  debounce, result rendering and navigation unchanged.

## Capabilities

### New Capabilities

- `search-input-accessible-name`: the shared search combobox names itself after
  the result scope it searches.

### Modified Capabilities

None.

## Impact

`apps/web/src/shared/ui/search/search-input.tsx`,
`apps/web/src/shared/ui/search/search-input-utils.tsx`, their colocated test and
the `SearchInput` double in `apps/web/src/app/(app)/reports/page.test.tsx`. No
API, shared-schema, authorization, persistence or transport change.

## Non-goals

- No placeholder-driven naming and no new caller-supplied label prop.
- No change to search scopes, product-hit exclusion, result routing or the search
  API contract.
- No native screen-reader claim: the executed evidence is the jsdom accessible
  name; the named-SR run stays with the parent integration.
