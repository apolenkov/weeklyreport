## Why

`prisma/wipe-manual-uat.ts:180-181` still carries a live
`TODO(PRISMA-TYPECHECK-01)` asking to "wire prisma/\*.ts into a typecheck
gate so a dropped-model ref (`tx.<gone>`) fails CI instead of crashing at
runtime." That gate already exists and works — the marker is stale and
should be removed, with the coverage it asks for recorded as a durable
invariant so it cannot silently regress.

The earlier change `add-prisma-typecheck-gate`
(`openspec/changes/archive/2026-05-26-add-prisma-typecheck-gate`) marked
all its tasks `[x]` but left no durable spec under `openspec/specs/` and
never deleted the in-code TODO. The wiring did land in two later commits
(`23acaa2d ci: add Prisma typecheck gate to lint pipeline` created
`tsconfig.prisma.json`; `c7b88b61 chore(package): add Prisma typecheck to
lint script` chained it into `pnpm lint`), so the work is real — only the
marker and the durable contract are missing.

## What Changes

This change is verify-and-tidy, not new implementation. The gate is
already built; nothing in `tsconfig.prisma.json` or `package.json` needs
to change.

1. Verified the gate covers every Prisma script: `tsconfig.prisma.json`
   sets `"include": ["prisma/**/*.ts"]` (`tsconfig.prisma.json:13`) and
   `tsc --listFiles` loads all 7 files
   (`_destructive-guard.ts`, `backfill-policy-rules.ts`, `reset-hard.ts`,
   `seed-constants.ts`, `seed-simple.ts`, `seed.ts`, `wipe-manual-uat.ts`).
2. Verified the gate catches a dropped-model ref: injecting
   `tx.nonExistentModel.deleteMany({})` into `wipe-manual-uat.ts` made
   `pnpm lint:prisma:typecheck` exit non-zero with
   `error TS2339: Property 'nonExistentModel' does not exist` — exactly
   the failure the TODO demanded (file restored, no diff).
3. Verified the gate is in `pnpm lint`: `package.json:21` chains
   `lint:prisma:typecheck`, defined at `package.json:24` as
   `tsc --project tsconfig.prisma.json --noEmit`.
4. Verified CI runs it: `.github/workflows/ci.yml:50` runs `pnpm lint`
   (whose own comment at lines 47-48 names the Prisma typecheck as one of
   its chained passes); no separate CI step is needed or wanted.
5. Remove the stale `TODO(PRISMA-TYPECHECK-01)` comment at
   `prisma/wipe-manual-uat.ts:180-181` — the only occurrence in the repo.
6. Record the coverage as a durable invariant by adding requirements to
   the `lint-toolchain-ownership` spec, which today documents the ESLint /
   Prettier / stylelint passes of `pnpm lint` but omits the Prisma
   typecheck pass entirely.

## Capabilities

### New Capabilities

<!-- none: the gate is not a new capability; it already exists and is
recorded against the existing lint-toolchain-ownership spec -->

### Modified Capabilities

- `lint-toolchain-ownership`: add two requirements — `pnpm lint` MUST
  chain a Prisma-scoped typecheck pass over `prisma/**/*.ts`, and that
  pass MUST fail on a reference to a Prisma model that no longer exists.
  Today the spec enumerates the ESLint, Prettier, and stylelint passes
  but never names the Prisma typecheck pass.

## Impact

- `prisma/wipe-manual-uat.ts` — delete the stale 2-line TODO comment
  (lines 180-181); no logic change.
- `openspec/specs/lint-toolchain-ownership/spec.md` — gains two
  requirements (applied at archive via the delta spec in this change).
- No change to `tsconfig.prisma.json`, `package.json`, or
  `.github/workflows/ci.yml` — they already satisfy the contract.
