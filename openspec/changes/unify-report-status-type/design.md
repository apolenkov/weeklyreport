## Context

The backlog target says API repositories leak raw Prisma row types across the
domain boundary. A thorough read-only reconnaissance found the boundary
already near-universally clean: port interfaces return shared/domain read
models everywhere except ONE leak — `admin-shared.ts` imports Prisma's
`ReportStatus` into the `AdminRepository.readReportForDelete` return type
(its sibling `periodStatus` field already uses the shared Zod-derived type).
Two more files re-declare the `"draft" | "published"` union inline
(`archive.service.ts` as a deliberate local mirror commented "so the domain
code does not import @prisma/client"; `period-transition.ts` in the
Zone-4-banned domain layer).

Two-seat council grilling (deep-reasoning adviser + Codex seat, both
verifying independently) adjudicated:

- Narrow `report-status-type` spec over a generic `repository-domain-boundary`
  spec (the deep-reasoning seat): the general invariant is pinned nowhere
  today, and honest generic wording must exempt the sanctioned Prisma-typed
  transaction applicators in `application/` (eslint Zone 4 documents them)
  and infrastructure internals — deferred as a named follow-up rather than
  shipped born-red.
- All three admin files swap, not just the port (the Codex seat): the queries
  and repository impl carry the same type-only import; leaving them creates
  same-module inconsistency for zero benefit.
- Enforcement is real, not doc-only (the Codex seat): `admin-shared.ts` joins
  the existing ESLint restricted-imports block — admin is a flat module that
  sits in no enforcement zone today.
- Parity sites join (the deep-reasoning seat): the SSOT rule "literals live
  in one home" is the same rule `traffic-light-status-type` just ratified;
  the archive and period-transition re-declarations convert.

Load-bearing invariants:

- Wire/DB compatibility: Prisma enum `ReportStatus { draft published }`
  matches `reportStatusSchema` exactly; the swap is type-position-only.
- Domain purity: `period-transition.ts` lives under the Zone-4
  `@prisma/client` ban — the shared type is the only legal source, which is
  exactly the fix.
- The sanctioned applicator pattern in `application/` is untouched and
  explicitly out of scope.

## Goals / Non-Goals

**Goals:**

- One home for the `"draft" | "published"` literals:
  `report-primitives.schema.ts`; the port and the re-declaration sites import
  the shared `ReportStatus`.
- Regression-proof the fixed port via the existing lint block; pin
  shared-vs-Prisma identity with a type test.
- Close the backlog target with corrected inventory.

**Non-Goals:**

- No generic repository-boundary spec (named follow-up, merged with the
  literal-union lint-gate follow-up from `traffic-light-status-type`).
- No `PrismaReportSectionWithRelations`/cast changes (named follow-up).
- No behavior, payload, or migration changes.

## Decisions

### D1: Mirror the traffic-light pattern exactly

Type export beside the schema; identity test in the api package
(`expectTypeOf<ReportStatus>().toEqualTypeOf<$Enums.ReportStatus>()`); a
narrow ADDED spec with the single-literal-home + composition rule. Precedent
keeps review cheap and the invariant uniform.

### D2: The port swap is compile-clean by construction

`admin-period.queries.ts` selects the row's `status` field and returns it;
Prisma's enum type and the shared inferred type are structurally identical
string-literal unions, so the pass-through assigns without casts. The only
downstream consumption is a `=== "published"` comparison.

### D3: Enforcement via the existing block, no new rule

`admin-shared.ts` is added to the files array of the existing
`no-restricted-imports` ban. One path, zero collateral: the repo has exactly
two `*-shared.ts` port files and the other already sits in a banned zone.

## Risks / Trade-offs

- Hidden fourth re-declaration -> repo-wide grep for the union in both
  orders + `z.enum` forms is part of verification.
- Archive's local-mirror comment becomes stale -> the comment is replaced by
  the shared import (its rationale — "domain must not import prisma" — is
  exactly what the shared type satisfies).
- Spec overreach -> the ADDED spec speaks only about the report-status value;
  the repository-boundary generalization is explicitly the follow-up.

## Migration Plan

1. Shared: add the type export.
2. Api: swap the three admin files; convert archive + period-transition
   unions; add the eslint path; add the identity test.
3. Update the backlog spec and delta: target CLOSED, follow-ups named.
4. Run the shared filter tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
