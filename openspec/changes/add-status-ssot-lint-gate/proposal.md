# Proposal: add-status-ssot-lint-gate

## Why

The two status SSOTs landed on 2026-07-10 (`unify-traffic-light-status-type`,
`unify-report-status-type`) hold only by convention: nothing stops a new file
from re-declaring `"green" | "yellow" | "red"` or `"draft" | "published"` as a
fresh literal union, and the repository port-type boundary is enforced on
exactly one file (`admin-shared.ts`). The `architecture-refactor-backlog` spec
names both gaps as the deferred follow-up — one lint regression gate serving
both SSOTs, plus a general port-type invariant. This change closes that
follow-up.

## What Changes

- New scanner `scripts/find-status-literal-unions.mjs` (the
  `find-archaeology.mjs` idiom): flags any TS union or `z.enum` outside the
  SSOT file that (a) contains all three traffic-light literals, or (b) whose
  status-literal set is exactly `{draft, published}`. Test files are covered;
  `prisma/seed-constants.ts` is the single documented allowlist entry (its
  tsconfig cannot resolve workspace packages); no inline annotation escape.
- Wire the scanner into lint-staged (staged `.ts`/`.tsx`) and into the root
  `lint` composite as `lint:status-literal-unions --all`, so both new commits
  and full sweeps are gated.
- Generalize the port-type boundary: extend the ESLint Zone 4
  restricted-import ban from `admin-shared.ts` to the inventory of
  port-declaring files (module service/contract files that define the
  interfaces domain and routers consume). Sanctioned Prisma users stay
  exempt: `infrastructure/**`, `*.prisma-repository.ts` adapters, transaction
  applicators in `application/`, admin query internals, and lib helpers.
- Remove the dead `ArchiveReport.status` vocabulary: `mapArchiveSummary`
  always writes `"published"` and no consumer reads the field; the
  `dashboard-mock-data.ts` duplicate (`ArchiveReport` + `MOCK_ARCHIVE`) has no
  consumers at all and is deleted.
- Record the backlog follow-up as closed in `architecture-refactor-backlog`.

## Capabilities

### New Capabilities

- `status-type-ssot-gate`: the literal-union regression gate — what the
  scanner flags, what it exempts, and where it is wired.
- `repository-port-type-boundary`: the general port-type invariant — port
  contract files must not import `@prisma/client`; sanctioned Prisma-typed
  applicators and infrastructure internals are exempt by wording.

### Modified Capabilities

- `architecture-refactor-backlog`: the two closure requirements stop naming
  the gate/invariant follow-ups as open future changes and record them as
  closed by this change.

## Impact

- New file: `scripts/find-status-literal-unions.mjs` (+ unit test).
- `package.json`: lint-staged entry, `lint:status-literal-unions` script,
  root `lint` composite.
- `eslint.config.ts`: Zone 4 file list grows by the port-file inventory.
- `apps/web/src/features/dashboard/model/dashboard.ts`,
  `apps/web/src/shared/lib/dashboard-mock-data.ts`: dead vocabulary removal
  (plus any test pinning the removed field).
- No runtime behavior changes; the dashboard field removal is dead code by
  traced evidence.
