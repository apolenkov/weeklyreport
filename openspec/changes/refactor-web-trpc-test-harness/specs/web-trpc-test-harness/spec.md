## ADDED Requirements

### Requirement: Component tests stub tRPC through the shared factory

Web component and hook tests under `apps/web/src` MUST obtain their
tRPC proxy stub from `createMockTRPC` in
`apps/web/src/test-utils/mock-trpc.ts` by passing an array of
path-descriptor entries (`{ path, query?, mutation? }`; full API in
the change's `design.md` D1), and MUST NOT hand-roll per-file objects
that re-encode the `queryOptions` / `mutationOptions` / `queryKey` /
`pathFilter` proxy shape.

#### Scenario: a new admin-tab test needs tRPC data

- **WHEN** a new component test stubs a query and captures a mutation
- **THEN** it passes procedure descriptors to `createMockTRPC` and
  asserts through its captured-mutation registry
- **AND** it defines no local `queryOptions`/`mutationOptions` shape

#### Scenario: the proxy shape changes upstream

- **WHEN** `@trpc/tanstack-react-query` changes the options-proxy shape
- **THEN** only the shared factory needs updating and the suites
  recompile against it

### Requirement: pathFilter stubs return a queryKey filter

A stubbed `pathFilter()` MUST return a `{ queryKey: ... }` filter —
the shape `invalidateQueries` matches on (the installed
`@trpc/tanstack-react-query` types it as
`WithRequired<QueryFilters, "queryKey">`). Stubs returning `{ tag }`
or other unknown-key shapes MUST NOT exist: TanStack's `matchQuery`
ignores unknown keys, so such filters match every query and turn
invalidation assertions into tautologies.

#### Scenario: an invalidation assertion is meaningful

- **WHEN** a test asserts that saving invalidates a specific cache
  domain
- **THEN** the filter observed by `invalidateQueries` carries a
  `queryKey`
- **AND** changing the production cache key makes the assertion fail

### Requirement: The auth-redirect link seam is covered by tests

The auth-redirect tRPC link in `apps/web/src/lib/trpc.ts` MUST have
unit tests covering its three observable behaviors: a 401 error
triggers the redirect handler and is swallowed (`complete` is NOT
called), a non-401 error propagates via `observer.error`, and
`next`/`complete` pass through unchanged.

#### Scenario: a regression makes the link swallow non-401 errors

- **WHEN** the swallow branch is widened beyond 401 by mistake
- **THEN** the propagate test fails before the change merges
