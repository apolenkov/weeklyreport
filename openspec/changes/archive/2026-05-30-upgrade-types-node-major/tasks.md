# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [x] Confirm the active Node major is 25 (`node -v`), matching `.nvmrc` (`25`)
      and `.github/workflows/ci.yml` `NODE_VERSION: "25"`; if local Node is
      still 24, switch with `nvm use` before proceeding.
- [x] Record the baseline: `pnpm typecheck && pnpm lint && pnpm test` all green
      on the unchanged tree, so any post-bump failure is attributable to the
      upgrade.

## Bump

- [x] In root `package.json` `devDependencies`, change `@types/node` from
      `^24.9.1` to `^25.9.1`.
- [x] In `apps/web/package.json` `devDependencies`, change `@types/node` from
      `^24.9.1` to `^25.9.1` (keep both workspaces on the same major).
- [x] Run `pnpm install` to update `pnpm-lock.yaml`; verify the resolved
      `@types/node` is `25.9.1` with `pnpm why @types/node` (no stray 24.x).

## Breaking-change migration

- [x] Run `pnpm typecheck` and triage every new error to a changed Node 25
      typing (removed/retyped global, builtin-module signature, `process` /
      `Buffer` / stream narrowing).
- [x] Fix each type-only break at the call site (correct the call, import the
      right type) — do not silence with `any`; if a real upstream gap forces an
      assertion, add it locally with a `// TODO` referencing the bump.
- [x] Re-run `pnpm lint`; address any new `@typescript-eslint` findings caused
      by the changed typings (e.g. unsafe-any flagged by the strict preset).

## Full gate run

- [x] `pnpm typecheck` passes across all workspaces.
- [x] `pnpm lint` passes with `--max-warnings=0` discipline intact.
- [x] `pnpm test` passes (unit + component suites).
- [x] `pnpm build` passes for `apps/web` and the rest of the build graph on
      Node 25.
- [x] Confirm `engines.node`, `.nvmrc`, and CI `NODE_VERSION` were NOT modified
      by this change (alignment-only; engines floor is intentionally left at
      `>=24.0.0`).
