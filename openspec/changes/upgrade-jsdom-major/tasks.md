# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read jsdom 27, 28, and 29 release notes / `CHANGELOG.md` and record the
      breaking changes that touch this repo: DOM/`Range`/selection APIs, `URL`,
      `fetch`, `structuredClone` semantics, and the Node-version baseline for
      each major.
- [ ] Confirm the local/CI Node satisfies the new jsdom Node baseline and the
      repo `engines` (`node >=24`); abort and report if the baseline exceeds it.
- [ ] Confirm `jsdom` is declared only in `apps/web/package.json` (not in other
      workspaces) so the bump is genuinely isolated.

## Bump

- [ ] Change `jsdom` from `^26.1.0` to `^29.1.1` in `apps/web/package.json`
      (devDependencies).
- [ ] Install for the `apps/web` workspace and refresh `pnpm-lock.yaml`
      (`pnpm install`); verify the resolved `jsdom` version is `29.1.1` and no
      unexpected peer-dep warnings appear.

## Migration

- [ ] Run the `apps/web` Vitest suite (`pnpm --filter @customreport/web test`)
      and triage failures by category (selection/`Range`, `URL`, `fetch`,
      `structuredClone`, other DOM behavior).
- [ ] Apply codemods / fixes for each breaking change: update affected test
      assertions and any jsdom-environment shims in `apps/web/vitest.setup.ts`
      and `apps/web/vitest.config.ts` (e.g. the comment at
      `apps/web/vitest.config.ts:49` about modules importable under jsdom). Fix
      the cause, not the symptom — do not delete or skip a failing test to make
      the suite green.
- [ ] Re-run the `apps/web` Vitest suite until it is fully green with no skipped
      or newly-quarantined tests.

## Gates

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `pnpm lint:md`.
- [ ] `openspec validate upgrade-jsdom-major --strict` passes.
- [ ] Hand the merge decision to the user with a short note: resolved jsdom
      version, breaking changes hit, files touched, and whether any behavior
      change warrants a closer look.
