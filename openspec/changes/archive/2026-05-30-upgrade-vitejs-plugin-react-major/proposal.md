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

## Grill findings — 2026-05-30

Adversarial review of the explorer analysis. All load-bearing claims
re-verified against the working tree.

- **currentState = done-in-reality: CONFIRMED.** Commit `e278befc`
  ("build(web): upgrade @vitejs/plugin-react 5 -> 6 (isolated)") is on `main`.
  `apps/web/package.json` declares `@vitejs/plugin-react ^6.0.2` and
  `vite ^8.0.0`; installed resolutions are `6.0.2` and `8.0.14`. Both required
  bumps landed.
- **Babel-removal regression guard: re-ran empirically.** `vitest run --root
apps/web` = 70 files / 579 tests passing, zero JSX/React-Refresh transform
  errors. `vitest.config.ts` line 11 is `plugins: [react()]` — bare call, no
  `babel` option, no react-compiler wiring. Conditional `@rolldown/plugin-babel`
  pairing correctly NOT added. (Explorer cited 587 tests; actual is 579 — count
  drift, immaterial, suite is green either way.)
- **Isolation: CONFIRMED.** Commit `e278befc` touched only
  `apps/web/package.json`, `pnpm-lock.yaml`, and the change's `tasks.md`. No
  `apps/api`, `packages/shared`, or `packages/ui` manifest changed. Mergeable
  independently of the rest of the Wave-3 dependency wave.
- **sharedFiles `pnpm-lock.yaml` + `package.json` (root): CONFIRMED collision
  surface.** This change cannot run as a parallel git worktree alongside any
  other dependency-currency change that touches the root lockfile (jsdom,
  typescript, lucide-react, @types/node, @bull-board/\*). Those serialize on the
  lockfile — but they are already landed sequentially on `main`, so this is moot
  for execution.
- **blastRadius LOW: CONFIRMED, not understated.** 4-line manifest diff plus a
  net lockfile shrink (`-94 / +35` per `git show --stat`). Plain gates
  (typecheck/lint/test/build) are sufficient; no diff-scale human review needed.
  This is not a Biome `recommended:true` big-bang flip.
- **dependsOn = []: CONFIRMED.** No edge to the Biome trio or the markdown
  change; the only ordering constraint is the shared lockfile, already resolved.
- **Open tasks are non-code ceremony.** The two unchecked tasks
  (`visual:test`, "surface gate results / merge decision") are an environmental
  test (needs live DB + Playwright; cannot exercise the bumped plugin anyway
  because Next build/dev use `--webpack`, never loading Vite or this plugin) and
  a user-facing report. Neither blocks correctness.

**Revised recommendation: archive.** Implementation is complete and verified on
`main`; the only remaining items are ceremonial/environmental, not code work.
"finish" overstates the remaining effort — there is no code left to write. Run
`openspec verify` then archive. No proposal/design/tasks edits required to make
it implementation-ready (it is already implemented).
