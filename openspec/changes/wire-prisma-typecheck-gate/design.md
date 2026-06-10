## Context

The repo already typechecks `prisma/**/*.ts` through a dedicated gate:

- `tsconfig.prisma.json:13` — `"include": ["prisma/**/*.ts"]`, extending
  `tsconfig.base.json` (which is `strict: true`).
- `package.json:24` — `lint:prisma:typecheck` = `tsc --project
tsconfig.prisma.json --noEmit`.
- `package.json:21` — `lint` = `eslint . && stylelint ... && pnpm
lint:prisma:typecheck`.
- `.github/workflows/ci.yml:50` — CI quality job runs `pnpm lint`; the
  comment at `ci.yml:47-48` explicitly names the Prisma typecheck as one
  of the chained passes.

The original `add-prisma-typecheck-gate` change (archived 2026-05-26)
ticked every task but produced no durable spec and never deleted the
in-code marker. The wiring it described actually landed later, in commits
`23acaa2d` and `c7b88b61`. So the only residue today is a stale
`TODO(PRISMA-TYPECHECK-01)` at `prisma/wipe-manual-uat.ts:180-181` and a
missing line in the durable lint spec.

This change does not build anything. It removes the stale marker and
records the existing coverage so a future refactor of `pnpm lint` or
`tsconfig.prisma.json` cannot silently drop Prisma-script typechecking.

## Goals / Non-Goals

**Goals:**

- Delete the stale `TODO(PRISMA-TYPECHECK-01)` (only occurrence:
  `prisma/wipe-manual-uat.ts:180`).
- Record the Prisma typecheck pass as a durable invariant under
  `lint-toolchain-ownership` so its absence becomes a spec violation.
- Leave behind reproducible evidence that the gate catches a dropped-model
  reference.

**Non-Goals:**

- No change to `tsconfig.prisma.json`, `package.json`, or
  `.github/workflows/ci.yml` — they already satisfy the contract.
- No new `tsconfig`, no new lint rule, no new CI step.
- No change to any Prisma script's runtime behavior; the wipe ordering and
  destructive guard are untouched.
- No new color tokens; no UI strings (this change touches no `apps/web`
  file).

## Decisions

### D1: Treat this as verify-and-tidy, not re-implementation

The orchestration brief flagged that the 2026-05-26 change was "archived
WITHOUT implementation." Investigation shows the tasks were marked done and
the wiring did land afterward in `23acaa2d` and `c7b88b61`. The gate is
live and correct. Re-adding `tsconfig.prisma.json` or the lint script
would duplicate working config.

Empirical proof the gate works: injecting
`droppedModelProbe: (await tx.nonExistentModel.deleteMany({})).count` into
`wipe-manual-uat.ts` produced `prisma/wipe-manual-uat.ts(183,38): error
TS2339: Property 'nonExistentModel' does not exist on type ...` and a
non-zero exit; the file was then restored with no diff.

**Alternative considered:** re-author the gate from scratch per the brief's
"archived without implementation" framing. Rejected — it would re-create
config that already exists and passes, contradicting "do not capture work
that is already done."

### D2: Record the invariant on `lint-toolchain-ownership`, not a new spec

The existing durable spec `openspec/specs/lint-toolchain-ownership/spec.md`
already owns which passes compose `pnpm lint` (it enumerates ESLint,
Prettier, stylelint) but never names the Prisma typecheck pass. Adding the
two requirements there keeps a single source of truth for the lint gate's
composition.

**Alternative considered:** introduce a fresh `prisma-tooling-gates`
capability (the name the archived delta used). Rejected — it would
fragment the lint-gate contract across two specs and orphan the original
delta's intent; `lint-toolchain-ownership` is the natural home.

### D3: Delete the marker rather than convert it to a `ComingSoonBadge`

The `deferred-feature-pattern` durable spec governs deferred features. This
feature is not deferred — it shipped. The `TODO(<ref>)` is simply stale, so
the correct action is deletion, which the spec's pattern allows for
completed work (the badge/stub guidance applies only to features still
deferred).

## Risks / Trade-offs

- [Removing the marker hides the rationale it carried] → The "why" (a
  dropped-model ref must fail the gate) is preserved durably in the new
  `lint-toolchain-ownership` requirement and its scenario, which is
  stronger than a code comment.
- [Spec claims coverage that a future `tsconfig.prisma.json` edit could
  break] → The added scenario is executable (`pnpm lint:prisma:typecheck`
  against a known-bad ref), so drift surfaces as a failing gate, not a
  silent contradiction.
- [Touching `wipe-manual-uat.ts` near the destructive wipe path] → The edit
  removes a comment only; no `deleteMany` call, ordering, or guard changes.
  The `destructive-db-guard` invariant is untouched.

## Migration Plan

No deploy, no data migration, no rollback concern. The single code edit is
a comment deletion in a script that is not part of the app runtime. The
spec delta is applied to `openspec/specs/` only at archive time, per the
OpenSpec lifecycle.

## Open Questions

None. All five verification claims in the proposal were checked against the
live files and commands listed above.
