# Upgrade jsdom 26 → 29 (apps/web test environment)

## Why

`apps/web` pins `jsdom` at `^26.1.0` (`apps/web/package.json`), the DOM
implementation behind the Vitest `jsdom` test environment
(`apps/web/vitest.config.ts` sets `environment: "jsdom"`). The current release is
`29.1.1` — three majors behind. Staying behind accrues silent debt: each major
ships DOM-API behavior changes (selection/`Range`, `URL`, `fetch`,
`structuredClone` semantics) and raises the Node baseline. The longer the gap,
the larger the eventual migration blast radius and the higher the chance an
unrelated dependency forces the bump under time pressure.

This is a Wave-3, deliberately **isolated** major upgrade: jsdom is a
test-only dev dependency, so a single breaking dependency can be validated and
landed (or rejected) on its own without sinking a multi-dep batch. The merge
decision stays with the user.

## What Changes

- Bump `jsdom` from `^26.1.0` to `^29.1.1` in `apps/web/package.json` (devDependency).
- Refresh the lockfile for `apps/web` and run the `apps/web` install.
- Apply any breaking-change migration the three-major jump requires
  (DOM/`Range`/selection APIs, `URL`, `fetch`, `structuredClone`, and any
  Node-baseline-driven shims in `apps/web/vitest.setup.ts` /
  `apps/web/vitest.config.ts`).
- Run the full `apps/web` Vitest suite plus the repo gates and resolve any
  jsdom-environment regressions.

## Impact

- **Package:** `apps/web` (`@customreport/web`) only — the dependency is not
  declared in any other workspace.
- **Files:** `apps/web/package.json`, root lockfile (`pnpm-lock.yaml`), and
  potentially `apps/web/vitest.setup.ts` / `apps/web/vitest.config.ts` if a shim
  or environment option changes.
- **Surface:** test-only. jsdom does not ship to production (`next build` uses
  the browser/webpack runtime, not jsdom), so the runtime blast radius is zero;
  the risk is entirely in the `apps/web` test suite (70 web test files).
- **Risk:** Medium-low and contained. Three majors of DOM-behavior drift can
  break jsdom-environment assertions (selection, `URL`, `fetch`,
  `structuredClone`). Node baseline must satisfy `engines` (`node >=24`), which
  it does. Isolated scope means a failed validation is rejected without
  affecting other upgrades.

## Non-goals

- **No other dependency bumps.** The other Wave-3 majors (`@types/node`,
  `@vitejs/plugin-react`, `typescript`, `lucide-react`, `@bull-board/*`) are
  separate isolated changes; this one touches only `jsdom`.
- **No Vitest or React upgrade.** Vitest 4 / React 19 stay pinned; only the
  jsdom environment implementation moves.
- **No production-runtime change.** jsdom is dev/test-only.
