# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [x] Confirm installed Vite already satisfies the v6 floor:
      `node -e "console.log(require('./apps/web/node_modules/vite/package.json').version)"`
      must be `>=8.0.0` (currently `8.0.14`). If it is below 8, stop and bump
      Vite first — v6 drops Vite 7 and below.
- [x] Confirm Node satisfies v6's `>=20.19 || >=22.12` baseline; repo `engines`
      pins `node >=24.0.0`, so this holds. Record the result.
- [x] Re-read `apps/web/vitest.config.ts` and confirm `react()` is called with
      no `babel` option and that react-compiler is NOT wired into the Vitest
      transform (it lives in `next.config.ts` `reactCompiler: true`, a separate
      path). This is the assumption the Babel-removal risk hinges on.

## Bump

- [x] In `apps/web/package.json` set `devDependencies["@vitejs/plugin-react"]`
      from `^5.2.0` to `^6.0.2`.
- [x] In `apps/web/package.json` raise `devDependencies["vite"]` from `">=7.3.2"`
      to `^8.0.0` to match the plugin's new minimum and the installed `8.0.14`.
- [x] `pnpm install` to refresh `pnpm-lock.yaml`; verify the resolved
      `@vitejs/plugin-react` is `6.0.2` and no Babel sub-deps linger that were
      only there for the old plugin.

## Migrate breaking changes

- [x] Verify the Babel removal did not regress the test transform: run
      `pnpm --filter @customreport/web test`. If (and only if) JSX/React-Refresh
      transform errors appear, add `@rolldown/plugin-babel` with the exported
      `reactCompilerPreset` to `apps/web/vitest.config.ts` per the v6 migration
      note; otherwise leave the config untouched. Do not add Babel speculatively.
- [x] Grep for any other `react({ ... })` call sites passing `babel`/options
      across the repo (`grep -rn "@vitejs/plugin-react" --include=*.ts` outside
      node_modules); the audit expects only `apps/web/vitest.config.ts`. Migrate
      any other call site found the same way.

## Gates

- [x] `pnpm typecheck && pnpm lint && pnpm test` all green.
- [x] `pnpm build` green (proves the Next.js production build, which owns the real
      react-compiler path, still compiles).
- [ ] `pnpm --filter @customreport/web visual:test` (or the documented web visual
      smoke) green — the transform-level regression guard.
      NOTE: not run in this sandbox (needs a live DB + Playwright browser + dev
      server). It also cannot exercise the bumped plugin: web `build`/`dev` use
      `--webpack`, so the Next path never loads Vite or `@vitejs/plugin-react`.
      The plugin's only consumer is `vitest.config.ts`; the Vitest suite (587
      passing) plus `pnpm build` are the real transform regression guards.
- [x] `pnpm lint:md` green for these planning docs.
- [x] `openspec validate upgrade-vitejs-plugin-react-major --strict` passes.

## Merge decision

- [ ] Surface the gate results to the user. Because this change is ISOLATED, the
      user decides whether to merge it independently of the rest of the
      dependency wave. (Surfaced via the implementing agent's report.)
