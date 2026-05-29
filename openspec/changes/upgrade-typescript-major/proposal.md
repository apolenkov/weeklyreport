# Upgrade TypeScript 5.9 → 6.0 (root, all strict-mode workspaces)

## Why

The repo pins `typescript` once at the root (`package.json` → `^5.8.3`,
resolving to `5.9.3`) and every workspace consumes it: `apps/api`, `apps/web`,
`packages/shared`, and `packages/ui` each run `tsc --noEmit` for typecheck and
lint, the root runs `tsc --project tsconfig.prisma.json --noEmit`
(`pnpm lint:prisma:typecheck`), and ESLint type-aware linting drives `tsc`
through `projectService` in `eslint.config.ts`. The current release is `6.0.3` —
a full major behind.

TypeScript 6.0 is a major: stricter defaults and removed deprecated
flags/APIs. Because the compiler underpins every typecheck, lint, and build
gate across all four strict-mode workspaces, the blast radius is the whole repo.
Staying behind only grows the gap and risks an unrelated dependency forcing the
bump later under worse conditions.

This is a Wave-3, deliberately **isolated** major upgrade — isolated from the
other Wave-3 majors so a single breaking dependency does not sink the batch.
"Isolated" here does not mean a single-line diff: TypeScript 6.0 must land
together with the `@typescript-eslint` 8.60 trio, which is the line that adds
TS6 support; bumping the compiler without it would break type-aware linting. The
merge decision stays with the user.

## What Changes

- Bump `typescript` from `^5.8.3` to `^6.0.3` at the root `package.json`
  (devDependency consumed by all workspaces).
- Co-bump the required `@typescript-eslint` trio to the TS6-supporting line
  (`8.60.0`) in the same change — these move in lockstep with the compiler:
  - `@typescript-eslint/eslint-plugin` `^8.58.1` → `^8.60.0`
  - `@typescript-eslint/parser` `^8.58.1` → `^8.60.0`
  - `typescript-eslint` `^8.58.1` → `^8.60.0`
- Refresh the root lockfile (`pnpm-lock.yaml`) via a single `pnpm install`.
- Apply the breaking-change migration the major requires — removed deprecated
  flags/APIs and stricter defaults surfaced across `tsconfig.base.json`, the
  per-workspace `tsconfig.json` files, `tsconfig.prisma.json`, and any source
  that the new strictness flags.
- Run the full repo gate fan-out (typecheck across all workspaces +
  `lint:prisma:typecheck`, lint, test, build, `lint:md`) and resolve every
  regression at the cause.

## Impact

- **Package:** root (`customreport`) for the `typescript` and `@typescript-eslint`
  declarations; the compiler change reaches **all four** workspaces
  (`apps/api`, `apps/web`, `packages/shared`, `packages/ui`) and the root
  `tsconfig.prisma.json` typecheck.
- **Files:** root `package.json`, root `pnpm-lock.yaml`, and potentially
  `tsconfig.base.json` / per-workspace `tsconfig.json` / `tsconfig.prisma.json`
  if removed flags or stricter defaults require config edits, plus any source
  files newly flagged by TS6 strictness.
- **Surface:** the compiler is the engine behind every `typecheck`, `lint`
  (each workspace lint runs `tsc --noEmit && eslint .`), and `build` script, so
  the validation surface is repo-wide — not a single test suite.
- **Risk:** High blast radius, as named in the audit. A major compiler bump can
  surface new type errors anywhere and remove flags the tsconfigs rely on; the
  tseslint trio must support TS6 or type-aware linting breaks. Isolated scope
  means a failed validation is rejected without disturbing the other Wave-3
  upgrades.

## Non-goals

- **No other Wave-3 major bumps.** `@types/node`, `@vitejs/plugin-react`,
  `jsdom`, `lucide-react`, and `@bull-board/*` are separate isolated changes;
  this one touches only `typescript` and its required tseslint trio.
- **The tseslint trio belongs to this change, not the minor batch.** Although
  `@typescript-eslint/*` and `typescript-eslint` also appear in the
  `dependency-upgrades-minor` audit list, they are claimed here as the required
  TS6 co-bump so they are not double-bumped elsewhere.
- **No Biome migration and no lint-rule changes** beyond what the tseslint trio
  upgrade itself entails. Biome is a separate, later change.
- **No tsconfig modernization for its own sake.** Config edits are limited to
  what TS6 removed flags / stricter defaults force; opportunistic option changes
  are out of scope.
