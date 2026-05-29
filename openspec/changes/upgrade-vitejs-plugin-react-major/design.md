# Design

## Context

`@vitejs/plugin-react` v6.0.0 is a genuine major, not a rename. Three upstream
changes intersect this repo:

1. **Vite 8+ required.** v6 drops Vite 7 and below. `apps/web/package.json`
   declares `vite ">=7.3.2"`, but the installed Vite is already `8.0.14`. The
   manifest floor is stale, not the runtime.
2. **Babel dependency removed.** Vite 8 performs the React Refresh transform via
   Oxc, so the plugin no longer bundles Babel. Consumers who passed
   `react({ babel })` must now pair the plugin with `@rolldown/plugin-babel`.
3. **React Compiler path moved.** `babel-plugin-react-compiler` users are pointed
   at `@rolldown/plugin-babel` + the exported `reactCompilerPreset`.

The only consumer of the plugin in this repo is `apps/web/vitest.config.ts`,
where it is invoked as bare `react()`. React Compiler is enabled for the Next.js
build through `next.config.ts` (`reactCompiler: true`) — a path that does not
route through `@vitejs/plugin-react`. So the Babel removal is not expected to
touch the Vitest 4 / React 19 / jsdom suite.

## Decision

**ADR: Adopt @vitejs/plugin-react v6 in apps/web as an isolated bump, with the
Babel pairing added only if a gate proves it is needed.**

- Move `@vitejs/plugin-react` to `^6.0.2` and raise the declared `vite` floor to
  `^8.0.0` so the manifest cannot resolve a Vite the plugin rejects.
- Do **not** add `@rolldown/plugin-babel` or `reactCompilerPreset` to the Vitest
  config pre-emptively. The current `react()` call passes no Babel options and
  the test transform does not run react-compiler, so the removed Babel dependency
  has no configured consumer in tests. Adding Babel back speculatively would
  re-introduce the dependency v6 deliberately drops and contradict the economy
  rule (single-pass, no redundancy).
- The conditional is empirical: the migration adds the Babel pairing **only if**
  `pnpm --filter @customreport/web test` surfaces a JSX/React-Refresh transform
  regression. The full gate plus a green web visual smoke is the evidence.
- Keep the change ISOLATED. A single breaking dependency must not sink the wider
  dependency wave; the merge decision stays with the user.

## Alternatives considered

- **Pin to v5, skip the major.** Rejected: defers the currency work and leaves
  the manifest's `vite ">=7.3.2"` floor inconsistent with both the plugin's
  future minimum and the installed `8.0.14`.
- **Eagerly wire `@rolldown/plugin-babel` + `reactCompilerPreset` into
  `vitest.config.ts`.** Rejected: the Vitest transform does not run react-compiler
  today, so this adds an unused dependency and config surface. It is only
  warranted if the gate proves the bare-`react()` transform regressed.
- **Batch this with the other Wave-3 majors (`jsdom`, `typescript`,
  `lucide-react`).** Rejected by the locked isolation rule: each breaking major
  is its own change so one failure does not block the others.
- **Also raise the React Compiler / Next build to the new Babel pairing in this
  change.** Rejected as out of scope: the Next build's react-compiler path is
  independent of `@vitejs/plugin-react` and is not affected by this bump.
