## Context

The full research, decision record, and rejected alternatives live in
`docs/architecture/TARGET-STRUCTURE-2026-07-02.md`. This design.md is the
condensed method + slice order + rollback for the migration; it does not restate
the citations. The starting state: api is a modular monolith two of whose four
invariant-bearing modules (period, report-sections) already carry the port
pattern (moderate admin carries it too); web is type-first and
partly flat (giant `components/<domain>/` + flat `lib/` mixing hooks/utils/mappers);
packages are already correctly layered but with enforcement holes and a wildcard
`exports` leak on `ui`.

## Chosen method

One method per app, each right-sized to an MVP two-app monorepo — finish patterns
already present, do not introduce new abstractions.

- **api — completed per-module hexagon.** Keep `modules/<domain>/` + top-level
  `infrastructure/`. Generalize the existing `period/` split
  (pure domain + application service + infra adapter + interface router) into the
  canonical intra-module layering, but ONLY where a load-bearing invariant exists
  (`period`, `report-sections`, `review`, `publication`) or a module exceeds ~6
  files. Thin CRUD stays flat. Governing law: the Dependency Rule — imports point
  inward; delete Nest/Prisma and the domain still compiles.
- **web — Feature-Sliced Design, lite (3 zones).** `app/` = routing only;
  `features/<domain>/` = slices with colocated `ui/` + `model/` + `api/` (slice
  barrel optional-minimal — research 2026-07-02: barrel proliferation carries a
  measured build/TS-server cost; api facade barrels stay mandatory);
  `shared/` = business-agnostic web layer. Reject the 6-layer taxonomy and a
  web-side `entities/`/`shared/ui` (packages/shared and packages/ui already own
  those). Collapse the finer catalog labels to the canonical domain vocabulary.
- **packages — strict one-way typed boundaries.** Exactly two packages; lock the
  acyclic graph as lint; curate `ui`'s wildcard `exports` toward a barrel (its own
  later slice).

**Placement is deterministic** via two axes (domain first, then layer/segment) plus
five determinism knobs — see the `directory-architecture-standard` spec delta and
§Grouping rules in the target-structure doc. There is one correct home per file.

## Slice order (blast radius, low → high)

Deliberately NOT "period first" (least effort in the raw research): period is the
atomic-write hotspot (~40 deep cross-module imports) and therefore highest risk, so
it lands last. Each slice is one future OpenSpec change, behavior-neutral, gated on
a clean target folder and a green unit gate.

1. **Enforcement ratchet baseline** — additive, zero file moves. Add the new
   boundary zones with all current violations allowlisted (forbid new, grandfather
   existing): package-name zones extend the existing
   `@typescript-eslint/no-restricted-imports` block; the two relative-path zones
   (api cross-module, web cross-slice) use `import-x/no-restricted-paths`, its
   native `except` carrying the allowlist; `eslint-disable` suppression forbidden.
   Protects every later slice from silent regressions.
2. **One self-contained leaf web slice — `landing`** (pinned: fully covered by
   `docs/architecture/mapping/`, unlike `search`) — proves the mechanic:
   relocate → `index.ts` → fix imports → edit eslint exemption list →
   live-verify web from source (the shared-src `.js`-extension webpack gotcha
   passes tsc/vitest but 500s the page).
3. **Remaining web slices**, one domain per change — including the giant `lead/`
   (→ report-sections + period + review) and `admin/`. `lib/mappers/` dissolves into
   each slice's `model/`; `report-shell`/`common`/`ui` primitives → `shared/`. Keep
   every move OUT of `app/` (a new `app/` route trips the e2e catalog-drift gate).
4. **api: complete the hexagon in the four invariant modules —
   {`period`, `report-sections`, `review`, `publication`}** (`admin` stays
   MODERATE-flat, not in this slice) — lift internal files into
   `domain/application/infrastructure`, push residual `@prisma`/`@nestjs` imports
   out of pure domain files, inject repositories by Symbol token. Reuse existing
   `*.contract.test.ts` as port-contract suites where the port exists (period,
   report-sections); introduce the port + contract suite for `review` and
   `publication`. Internal only, no cross-module rewiring.
5. **api: wrap infra as ports** — EmailPort over `infrastructure/email`, QueuePort
   over `infrastructure/bullmq`, CachePort over redis; bind per module boundary.
   Payoff: reminders/analytics/pdf-export become unit-testable with in-memory fakes.
6. **api: reroute cross-module deep imports to facades + flip the cross-module zone
   allowlist→error** — highest risk. Each module exports only a facade via
   `@Module.exports` and re-exports it (plus the module class) from the module's
   `index.ts` barrel; siblings import only that barrel (the zone's sole `except`
   pattern), never a raw `*.prisma-repository` or other internal path. Design
   a `withTransaction(fn)`/UnitOfWork seam BEFORE this slice so the atomic period
   write and publish atomicity don't leak `Prisma.TransactionClient`. Gate on
   `pnpm test:integration` (single-thread, postgres+redis up), not just unit tests.

## Rollback

- **Per slice, pre-merge:** each slice is behavior-neutral and self-contained, so a
  failing gate (unit, or integration for slice 6) reverts to `git checkout` of the
  slice's staged paths — no schema or data migration is involved, nothing to undo
  in the database.
- **Enforcement zones:** a new zone that surfaces an unexpected violation storm is
  softened by widening its allowlist (ratchet stays green) rather than reverting the
  whole slice; only the final cross-module flip (slice 6) turns an allowlist into an
  error, and that flip is a one-line config revert if integration goes red.
- **Post-merge:** because every slice is a pure relocation + import-fix (plus a
  minimal barrel where consumed), a
  later `git revert` of the slice commit restores the prior tree without touching
  product behavior; the enforcement-baseline slice (1) is the only one other slices
  depend on, and it is additive, so reverting a later slice never orphans a boundary.
- **Parallel-session safety:** slices are gated on a clean target folder and stage
  only their own paths, so a rollback never collides with an unrelated dirty folder.
