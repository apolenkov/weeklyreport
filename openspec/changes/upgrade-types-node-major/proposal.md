# Upgrade @types/node 24 -> 25 (major)

## Why

`@types/node` is declared as `^24.9.1` in two workspaces (root `package.json`
and `apps/web/package.json`; resolves to 24.12.4 today). The actual Node major
in use has already moved to 25: `.nvmrc` is `25` and CI runs
`NODE_VERSION: "25"` (`.github/workflows/ci.yml`). The type definitions are
therefore one major behind the runtime they describe, which can hide or
mistype Node 25 APIs that the code legitimately runs against.

The recognized hazard with `@types/node` is the inverse — bumping types _ahead_
of the runtime surfaces typings for APIs not present at execution. That hazard
does not apply here: bumping to `^25.9.1` brings the types **into** alignment
with the Node 25 used by `.nvmrc` and CI. The only lower bound is
`engines.node = ">=24.0.0"`, which is a floor, not the major actually run; this
change deliberately does not touch `engines` (see design.md).

This is a Wave-3 ISOLATED major upgrade: it ships alone so one breaking type
update cannot sink a larger batch. The merge decision is the user's.

## What Changes

- Bump `@types/node` from `^24.9.1` to `^25.9.1` in the root `package.json`
  `devDependencies` and in `apps/web/package.json` `devDependencies`, keeping
  both workspaces on the same major.
- Refresh the pnpm lockfile so the resolved `@types/node` is 25.9.1.
- Apply any type-only migration the bump forces (changed/removed Node global or
  builtin-module typings, narrowed signatures); resolve with code edits or
  documented local type assertions, not by widening to `any`.
- Run the full gate suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`) on Node 25 to confirm alignment is clean.

Out of scope: changing `engines.node`, `.nvmrc`, the CI `NODE_VERSION`, or any
other dependency. `apps/api` does not declare `@types/node` and is untouched.

## Impact

- Affected packages: root (`customreport`), `apps/web` (`@customreport/web`).
- Affected files: `package.json`, `apps/web/package.json`, `pnpm-lock.yaml`,
  plus any source files needing a type-only fix.
- New capability spec: `dependency-currency` (the alignment invariant).
- Risk: Low. Types move to match the runtime already in `.nvmrc` and CI, not
  ahead of it. `@types/node` majors can drop or retype builtin signatures, so a
  small number of type-only edits in `apps/web` or shared code is possible;
  the typecheck gate catches them. No runtime/behavior change.
