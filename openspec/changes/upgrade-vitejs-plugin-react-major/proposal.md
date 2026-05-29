# Upgrade @vitejs/plugin-react 5 -> 6 (isolated)

## Why

`apps/web` (`@customreport/web`) pins `@vitejs/plugin-react ^5.2.0`. Latest is
`6.0.2`. This is a Wave-3 dependency-currency bump, deliberately kept ISOLATED so
one breaking dependency cannot sink a larger batch — the merge decision is the
user's.

The major is not cosmetic. v6.0.0 (2026-03-12) makes three changes that touch
this stack directly:

- It **requires Vite 8+** and drops Vite 7 and below. `apps/web/package.json`
  still declares `vite ">=7.3.2"`, even though the installed Vite is already
  `8.0.14`. The declared floor must move to `^8.0.0` so the manifest cannot
  resolve a Vite the plugin no longer supports.
- It **removes the bundled Babel dependency**. Vite 8 handles React Refresh via
  Oxc and no longer needs Babel for it. Anyone who fed Babel options to
  `react({ babel: ... })` must instead pair the plugin with
  `@rolldown/plugin-babel`.
- It **changes the React Compiler path**: `babel-plugin-react-compiler` users are
  steered to `@rolldown/plugin-babel` with the exported `reactCompilerPreset`.

The blast radius here is narrow but must be verified, not assumed. The only
consumer of this plugin is `apps/web/vitest.config.ts`, which calls `react()`
with no options — it passes no `babel` config and does not wire react-compiler
into the test transform. React Compiler is enabled for the _Next.js build_ via
`next.config.ts` (`reactCompiler: true`), a path that does not go through
`@vitejs/plugin-react` at all. So the Babel removal should not regress the
Vitest 4 / React 19 / jsdom test setup — but the full gate must prove it.

## What Changes

- Bump `@vitejs/plugin-react` `^5.2.0` -> `^6.0.2` in `apps/web/package.json`
  (`devDependencies`).
- Raise the declared Vite floor in `apps/web/package.json` from `">=7.3.2"` to
  `^8.0.0` to match the plugin's new minimum and the already-installed `8.0.14`.
- Confirm `react()` in `apps/web/vitest.config.ts` still needs no Babel/
  react-compiler options under v6; only add `@rolldown/plugin-babel` +
  `reactCompilerPreset` IF a gate proves the test transform regressed without it
  (it is not expected to).
- Refresh the pnpm lockfile for the bumped range.
- Run the full gate (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`,
  plus `pnpm lint:md`) and the web visual/E2E smoke as a regression check.

## Impact

- **Affected workspace:** `apps/web` (`@customreport/web`) only. No `apps/api`,
  `packages/shared`, or `packages/ui` change.
- **Affected files:** `apps/web/package.json`, `pnpm-lock.yaml`, and
  `apps/web/vitest.config.ts` only if the conditional Babel pairing proves
  necessary.
- **Risk:** Low-to-medium. The Vite 8 / Node baseline is already satisfied
  (installed Vite `8.0.14`, engines `node >=24.0.0`). The real risk is the Babel
  removal silently changing the JSX/React-Refresh transform used by the 70 web
  Vitest files; the gate plus a green visual smoke is the guard. Isolated by
  design so a regression here does not block the rest of the dependency wave.
- **Out of scope:** other Wave-3 majors (`jsdom`, `typescript`, `lucide-react`,
  `@types/node`, `@bull-board/*`) — each is its own isolated change.
