## Why

BL-25 (P2, `docs/reviews/repo-excellence-review-2026-07-14.md`, "P2/P3 —
сжато"): two latent matching/contract gaps live in `apps/api`, both about a
function's contract promising precision it doesn't deliver — currently
harmless because today's inputs happen not to trigger the gap, but a future
input (a renamed constraint, a new excludable search type) would silently
fall through.

This is the **api-matching half** of BL-25's two-way split, cut by seam
(matching/contract logic in `apps/api`) rather than by literal file grouping —
see `shared-schema-strictness` for the other half (Zod schema shape in
`packages/shared`) and its split rationale. The original review order was
"publishedById, web-vital bound, P2002 substring matching, search
excludeTypes" as one grab-bag; splitting strictly by "P2002 = errors, search =
schema" would leave search's own gap homeless (it's neither a Zod schema nor
Prisma error matching — it's a repository contract), so both remaining items
are grouped here as "api-side matching/contract precision gaps" instead.

## What Changes

- `apps/api/src/lib/prisma-unique-violation.ts`: `isUniqueViolation`'s scoped
  match uses plain substring containment (`identity.includes(scope.index)` /
  `.includes(column)`) over the serialized `meta` + `message` blob. Today's
  constraint/column names are distinctive enough that this never
  false-positives, but nothing prevents a future constraint or column name
  from being a substring of an unrelated identifier, causing a scoped guard
  to accept the WRONG P2002 and mask a real error as the wrong domain error.
  Move to word-boundary / quoted-token matching (or otherwise document the
  distinctiveness requirement as a load-bearing naming constraint checked at
  the call site).
- `apps/api/src/modules/search/search.prisma-repository.ts`: the `excludeTypes`
  parameter's contract (documented in the function's own comment: "guard each
  optional chunk the same way if more become excludable") is honored only for
  `"project"` — the `item`/`risk`/`decision` UNION ALL chunks are always
  emitted regardless of `excludeTypes`. Currently inert (the only caller,
  `resolveSearchExcludeTypes` in `search.service.ts`, only ever passes
  `["project"]` or `[]`), but the parameter's declared type is
  `SearchHit["type"][]` — general, not `"project"`-only — so the repository
  silently ignores a valid, well-typed exclusion request for any other type.
  Guard every chunk uniformly with `excludeTypes.includes(<type>)`.

## Claim disposition

| Claim (BL-25 sub-item)                                         | Verdict                                                                                                                                                                                                                              | Action                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `isUniqueViolation` scope match is plain substring containment | CONFIRMED — read `prisma-unique-violation.ts`; `identity.includes(scope.index)` / `.every((c) => identity.includes(c))`, no word-boundary check                                                                                      | Harden matching             |
| `excludeTypes` only honors `"project"`                         | CONFIRMED — read `search.prisma-repository.ts:116-140`; only `projectChunk` is gated by `excludeTypes.includes(...)`; item/risk/decision chunks are unconditional. Repository's own comment self-documents this as the current scope | Guard every chunk uniformly |

## Non-goals

- Not touching `packages/shared/src/schemas/{period,web-vitals}.schema.ts` —
  those are `shared-schema-strictness`.
- Not changing `isUniqueViolation`'s unscoped behavior (no scope → any P2002
  matches) — untouched, per `prisma-unique-violation-guard`'s existing
  "Matcher Is Proven By A Real-Database Integration Test" requirement, which
  this change does not need to re-litigate.
- Not adding a caller that actually excludes `item`/`risk`/`decision` from
  search — no product requirement asks for that today; this change only
  makes the repository honor the contract its own type signature already
  promises.
- Not touching the two intentional unscoped P2002 swallow-sites
  (`carry-over`, `policy-applicator`) called out in
  `prisma-unique-violation-guard`'s "Ad-Hoc Detectors Consolidate Onto The
  Shared Guard" requirement — those stay unscoped by design.

## File manifest

- `apps/api/src/lib/prisma-unique-violation.ts` — `isUniqueViolation`'s
  `indexMatch` / `columnsMatch` derivation
- `apps/api/src/lib/prisma-unique-violation.test.ts` (extend existing
  coverage) — a scope whose index/column name is a substring of an
  unrelated identifier must NOT match
- `apps/api/src/modules/search/search.prisma-repository.ts` — the
  `itemChunk` / `riskChunk` / `decisionChunk` construction (currently
  unconditional; mirror the `projectChunk` pattern)
- `apps/api/src/modules/search/search.prisma-repository.test.ts` or
  equivalent integration coverage under `apps/api/src/modules/search/` —
  assert a hit of an excluded type never appears when `excludeTypes`
  includes it (parametrized per type, not just `"project"`)

## Verification

P2 contract-strictness bar: full gate + affected unit/integration suites.

- `pnpm --filter @customreport/api db:generate`
- `pnpm --filter @customreport/api test` (unit)
- `pnpm test:integration` (search repository hits a real Postgres full-text
  index; per `integration-gate-single-thread-and-docker-up`, single-threaded,
  docker up first)
- `pnpm typecheck && pnpm lint && pnpm test`
- `openspec validate api-contract-matching-strictness --strict`

## Sequencing

Independent of every other change in this batch. Touches
`apps/api/src/lib/prisma-unique-violation.ts`, which `latent-robustness-gaps`
does NOT touch (that change's `ensure-lead-section.ts` item calls
`isUniqueViolation` but only as a consumer, not a modifier) — no file overlap,
either order is safe.
