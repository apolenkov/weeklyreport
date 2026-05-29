# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read the TypeScript 6.0 release notes / announcement and record the
      breaking changes that touch this repo: removed deprecated compiler flags
      and APIs, stricter type-checking defaults, and any `tsconfig` option
      changes. Do not assume specifics from memory — capture them from the notes.
- [ ] Read the `@typescript-eslint` 8.60 release notes and confirm `8.60.0` is
      the line that adds TypeScript 6.0 support; record any rule-behavior or
      parser changes that come with the trio bump.
- [ ] Confirm `typescript` is declared only at the root `package.json` and that
      the `@typescript-eslint/*` + `typescript-eslint` trio is also root-level,
      so the bump set is exactly these four entries.
- [ ] Inventory the typecheck surface to validate against: `apps/api`,
      `apps/web`, `packages/shared`, `packages/ui` (each runs `tsc --noEmit -p
    tsconfig.json`), plus the root `tsconfig.prisma.json`
      (`pnpm lint:prisma:typecheck`), plus ESLint type-aware linting via
      `projectService` in `eslint.config.ts`.

## Bump

- [ ] In the root `package.json`, change `typescript` from `^5.8.3` to `^6.0.3`.
- [ ] In the root `package.json`, co-bump the required tseslint trio to the
      TS6-supporting line: `@typescript-eslint/eslint-plugin`,
      `@typescript-eslint/parser`, and `typescript-eslint` from `^8.58.1` to
      `^8.60.0`.
- [ ] Run a single `pnpm install` and refresh `pnpm-lock.yaml`; verify the
      resolved versions (`typescript@6.0.3`, the tseslint trio at `8.60.0`) and
      check for new peer-dependency warnings across the workspace graph.

## Migration

- [ ] Run typecheck across the whole graph (`pnpm typecheck`) plus
      `pnpm lint:prisma:typecheck`, and triage failures by category: removed
      flags rejected by the tsconfigs, stricter-default type errors in source,
      and tseslint type-aware-linting changes.
- [ ] Apply the breaking-change migration for each category: update
      `tsconfig.base.json`, the per-workspace `tsconfig.json` files, and
      `tsconfig.prisma.json` for removed/renamed flags; fix source flagged by the
      new strict defaults. Fix the cause — do not add `// @ts-expect-error`,
      loosen strict flags, or disable lint rules to mask a real new error.
- [ ] Re-run `pnpm lint` so ESLint type-aware linting runs under the new
      tseslint trio against TS6; resolve any rule-behavior regressions at the
      cause rather than suppressing rules.
- [ ] Iterate per-workspace (`pnpm --filter @customreport/api typecheck`, then
      `web`, `shared`, `ui`) until every workspace and the prisma typecheck are
      clean.

## Gates

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `pnpm lint:md`.
- [ ] `openspec validate upgrade-typescript-major --strict` passes.
- [ ] Hand the merge decision to the user with a short note: resolved
      `typescript` and `@typescript-eslint` versions, breaking changes hit,
      tsconfig/source files touched, and whether any new strictness warrants a
      closer look before merge.
