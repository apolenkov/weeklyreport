# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [x] Read jsdom 27, 28, and 29 release notes / `CHANGELOG.md` and record the
      breaking changes that touch this repo: DOM/`Range`/selection APIs, `URL`,
      `fetch`, `structuredClone` semantics, and the Node-version baseline for
      each major. (27/28/29 mainly drop old Node baselines, advance the bundled
      Web IDL / CSS / nwsapi engines, and tighten URL/selection spec
      conformance; jsdom@29.1.1 engines = `^20.19.0 || ^22.13.0 || >=24.0.0`.)
- [x] Confirm the local/CI Node satisfies the new jsdom Node baseline and the
      repo `engines` (`node >=24`); abort and report if the baseline exceeds it.
      (Local Node v26.0.0; repo engines `>=24.0.0` both satisfy jsdom's
      `>=24.0.0` floor.)
- [x] Confirm `jsdom` is declared only in `apps/web/package.json` (not in other
      workspaces) so the bump is genuinely isolated. (Only declaration is
      `apps/web/package.json`; the `.next/standalone` copy is a build artifact.)

## Bump

- [x] Change `jsdom` from `^26.1.0` to `^29.1.1` in `apps/web/package.json`
      (devDependencies).
- [x] Install for the `apps/web` workspace and refresh `pnpm-lock.yaml`
      (`pnpm install`); verify the resolved `jsdom` version is `29.1.1` and no
      unexpected peer-dep warnings appear.

## Migration

- [x] Run the `apps/web` Vitest suite (`pnpm --filter @customreport/web test`)
      and triage failures by category (selection/`Range`, `URL`, `fetch`,
      `structuredClone`, other DOM behavior). (One failure:
      `risks-section.snapshot.test.tsx` — an attribute-selector case match drift
      in jsdom's bundled nwsapi.)
- [x] Apply codemods / fixes for each breaking change: update affected test
      assertions and any jsdom-environment shims in `apps/web/vitest.setup.ts`
      and `apps/web/vitest.config.ts` (e.g. the comment at
      `apps/web/vitest.config.ts:49` about modules importable under jsdom). Fix
      the cause, not the symptom — do not delete or skip a failing test to make
      the suite green. (Corrected the test's `querySelector` to the actual
      rendered aria-label `Risk stages: All stages`; previously the lowercase
      selector matched nothing and the stored snapshot was a meaningless `null`.
      Snapshot regenerated to capture the real meta-row element. No shim
      changes needed.)
- [x] Re-run the `apps/web` Vitest suite until it is fully green with no skipped
      or newly-quarantined tests. (71 files / 587 tests pass, 0 skipped.)

## Gates

- [x] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [x] Run `pnpm lint:md`.
- [x] `openspec validate upgrade-jsdom-major --strict` passes.
- [x] Hand the merge decision to the user with a short note: resolved jsdom
      version, breaking changes hit, files touched, and whether any behavior
      change warrants a closer look.
