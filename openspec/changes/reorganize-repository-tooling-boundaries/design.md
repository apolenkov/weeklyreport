## Current closure boundary

The runtime-sweep relocation below is retained as historical context for the
completed source-layout migration. `replace-runtime-sweep-with-product-acceptance`
later deleted that platform. Current closure MUST validate colocated product
suites; it MUST NOT recreate, freeze, or execute a browser acceptance contour
or the historical runtime campaign.

## Context

The 2026-08-05 inventory found 4,328 tracked files and 2,027 TS/JS files.
Logical product boundaries are already strong (zero production deep imports
between web slices or API modules), but physical ownership is obscured by four
flat zones: runtime-sweep (177 direct files), Prisma (112), scripts (52), and
transitional web roots. Four maintained script tests are runnable (16/16) but
absent from every normal gate. The existing directory spec applies primarily to
`apps/*/src` and `packages/*/src`; it does not prevent auxiliary roots from
regrowing.

This is a behavior-neutral source-layout migration. It preserves period
dual-state writes, the role-coverage middleware identity gate, the production
destructive-DB guard, and deferred-feature behavior. No request payload, Prisma
model, tRPC surface, or rendered UI is intentionally changed.

## Goals / Non-Goals

**Goals:**

- Give every maintained file one deterministic concern owner and bounded home.
- Make executable entrypoints, reusable implementation, tests, and owned data
  visibly distinct but colocated by capability.
- Make flat-directory debt and orphan repository tests machine-detectable.
- Preserve existing command names and public facades while paths migrate.
- Complete the high-value auxiliary and transitional web migrations without
  creating a replacement browser campaign.

**Non-Goals:**

- Product behavior or database-schema changes.
- Rewriting archived OpenSpec/campaign evidence.
- A new workspace package, `entities` layer, or universal API hexagon.
- Curating the `packages/ui` wildcard export map in the same change.

## Decisions

### 1. Extend the existing two-axis rule instead of inventing a parallel model

Product source continues to use domain then layer. Auxiliary roots use concern
then role: for example `runtime-sweep/matrix/compiler.ts`,
`prisma/seeds/profiles/seed-profile-runner.ts`, or `scripts/eslint/suppression/ledger.ts`.
Alternatives considered were filename prefixes in flat folders (current state,
poor scanning/ownership) and one package per tool family (unnecessary resolution
and Knip workspace semantics).

### 2. Catalogue ownership before moving files

A checked, machine-readable ownership catalogue records current path, target
path, concern, role, entrypoint status, test owner, and data owner. Every tracked
file in a migrated root appears exactly once. A validator rejects duplicate,
missing, stale, or cross-concern targets. This makes moves reviewable and gives
parallel agents disjoint ownership.

### 3. Use a density ratchet with explicit bounded-flat exceptions

The structural gate inventories direct maintained files per directory. More than
30 direct files requires a split unless the durable directory standard declares a
single-concern flat exception. An exception stores its current count as a
non-increasing baseline and cannot broaden silently. Count is a trigger for
review; the ownership catalogue decides the actual split, so arbitrary five-file
folders are not rewarded.

### 4. Keep stable commands/facades while implementation moves

Root `package.json` script names, Prisma's `prisma/seed.ts` entrypoint, runtime
artifact schemas, and feature/API facades remain stable. Path consumers are
updated atomically. Thin wrappers are allowed only at true external entrypoints
and are removed when no external contract requires them; compatibility wrappers
must not become duplicate implementations.

### 5. Target trees follow real concern families

```text
scripts/
  shared/
  eslint/{shared,policy,suppression}/
  quality/{exemplary,react-doctor,type-cycles}/
  gates/{configuration,critical-tests,environment,formatting,operations,
         planning-provenance,status-ssot,type-system,vitest-rules,web-coverage}/

e2e/runtime-sweep/
  source/ manifest/ matrix/ preflight/ replay/
  evidence/ scenarios/{faults,concurrency,infrastructure}/
  driver/ support/

prisma/
  schema.prisma migrations/ seed.ts
  guards/ operations/{reset,wipe,backfill}/
  seeds/{support,profiles,minimal,simple,demo,advanced,stress}/

apps/web/src/
  app/ features/<canonical-domain>/{ui,model,api}/
  shared/{ui,lib,hooks,server}/
```

`report-pages` retains only genuine page composition. Domain logic migrates to
report-sections, period, or review behind existing barrels. Root `lib`, hooks,
and server files split by consumer ownership; domain-specific hooks do not get
dumped into shared.

The surviving page composition is not allowed to remain a second flat bucket.
Lead page composition is grouped into `lead/shell`, `lead/bridges`, and
`lead/chrome`; assembled weekly, head, and product composition use `weekly`,
`head`, and `product`. Source and tests move together, the public facade keeps
its six existing exports, and every direct directory stays at or below 30 files.
Client-only cross-slice hooks use an explicit `client.ts` entrypoint so the pure
`index.ts` facade never acquires a transitive client boundary.

Tool-owned data follows the same rule. ESLint policy and suppression ledgers
remain inside their respective concern directories; exemplary, React Doctor,
type-cycle, and Vitest baselines remain beside the validator that owns them.
A generic `scripts/ledgers` or flat `scripts/gates` directory would hide the
same ownership boundary this migration exists to restore and is therefore not
an allowed target.

The tooling catalogue uses these concrete owners:

| Target concern                                               | Owned family                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `scripts/eslint/shared`                                      | parser/comment utilities shared by ESLint policy and suppression checks                   |
| `scripts/eslint/policy`                                      | config ownership/scope measurement, policy scope probes, schema, tests, and policy ledger |
| `scripts/eslint/suppression`                                 | inventory, retained probes, schema, tests, adjudication command, and suppression ledger   |
| `scripts/quality/exemplary`                                  | catalogue, file classification, floor ratchet, tests, and baseline                        |
| `scripts/quality/react-doctor`                               | baseline parser, gate, tests, and baseline                                                |
| `scripts/quality/type-cycles`                                | dependency-cycle ratchet, tests, and baseline                                             |
| `scripts/gates/critical-tests`                               | critical marker and P0 evidence model/verifier                                            |
| `scripts/gates/planning-provenance`                          | OpenSpec provenance and deferred-reference validation                                     |
| `scripts/gates/formatting`                                   | Prettier scope and Stylelint planted gates                                                |
| `scripts/gates/type-system`                                  | exact-optional and type-coverage planted gates                                            |
| `scripts/gates/operations`                                   | production Compose and restore safety gates                                               |
| `scripts/gates/status-ssot`                                  | status vocabulary scanner and tests                                                       |
| `scripts/gates/vitest-rules`                                 | Vitest rule verifier, tests, and ledger                                                   |
| `scripts/gates/environment`, `configuration`, `web-coverage` | the corresponding single-purpose repository gates                                         |
| `scripts/gates/orchestrator`                                 | the sole non-fail-fast lint orchestrator                                                  |

### 6. Repository tests require explicit execution ownership

Every maintained `*.test.*`/`*.spec.*` outside ordinary workspace test discovery
must be named by exactly one repository-test manifest consumed by the aggregate
lint gate. Discovery tests compare the tracked inventory to actual runners. The
four currently orphaned Node tests enter that manifest before any move.

### 7. Validate in slices, then close with deterministic product evidence

Each concern move runs targeted typecheck/lint/tests and stale-path searches.
After all moves, the full deterministic local gates run once at the exact final
SHA. The successful r29 preflight remains diagnostic historical evidence, not
current acceptance evidence; no browser replacement contour is created.

## Risks / Trade-offs

- **Root-relative path drift** -> one tested repo-root resolver and explicit
  post-move tests for every data/baseline reader.
- **Knip false dead-code reports** -> update recursive entries and projects in
  the same slice; never hide paths with `ignore`.
- **ESM import breakage** -> preserve explicit `.ts` extensions and run the
  scripts TypeScript project plus direct Node tests after every family.
- **Prisma CLI/seed breakage** -> keep `prisma/seed.ts` stable, move one seed
  family at a time, and run profile contract/target-guard tests before DB use.
- **Runtime evidence incompatibility** -> preserve serialized schemas and
  artifact-relative paths; validate old fixtures and regenerate only source-bound
  campaign artifacts.
- **A prettier tree increases coupling** -> compare import-edge metrics before
  and after; any new production deep edge is a regression.
- **Very large rename review** -> commit independently reversible concern slices
  and record exact path maps in the archive and change tasks.

## Migration Plan

1. Land ownership catalogue, density/test-discovery validators, and the four
   missing test registrations without moving files.
2. Move `scripts` by family; update commands, Knip, current docs/specs, and
   baseline readers.
3. Move runtime-sweep by concern behind stable index/config entrypoints; run its
   complete unit harness.
4. Move Prisma seed families, profile orchestration, operations, and guards;
   keep schema/migrations/root seed entrypoint fixed and run disposable-DB gates.
5. Migrate web transitional roots and repair test-only deep imports; then clean
   API test harness deep edges without moving healthy production modules.
6. Re-run the structural inventory and require no unexplained directory above the
   density threshold and no new deep production edge.
7. Run Prettier, lint, typecheck, unit/integration/build/OpenSpec gates and
   freeze a new source SHA without a separate browser acceptance platform.

Rollback is per concern slice with ordinary Git revert. No schema/data rollback
is involved. The current branch and external r29 artifacts preserve the previous
state.

## Open Questions

None block implementation. Any directory over the threshold whose consumer map
contradicts the proposed family is adjudicated in the ownership catalogue before
its move, not guessed during rename.
