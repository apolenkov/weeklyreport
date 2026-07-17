# Tasks

## 1. Characterization pin (before touching the fix)

- [ ] 1.1 Write a unit test for the repo-root resolution helper that pins
      current CORRECT behavior on the real repo tree: starting from
      `e2e/integration/`, walking up finds the repo root (the directory
      containing the top-level `package.json`) after exactly 2 levels, not 4.
- [ ] 1.2 Confirm the pin fails against the existing hardcoded
      `../../../..` (4-up) resolution before the fix lands — this proves the
      test actually exercises the bug, not just the happy path.

## 2. Fix the path derivation

- [ ] 2.1 In `e2e/integration/global-setup.ts`, replace the hardcoded
      `path.resolve(__dirname, "../../../..")` with a function that walks
      up from `__dirname` checking for `package.json` at each level, and
      returns the first directory where it is found.
- [ ] 2.2 Throw a descriptive error (e.g. "could not locate repo root above
      <dir>") if no ancestor directory contains `package.json`, instead of
      silently returning an out-of-workspace path.
- [ ] 2.3 Delete the stale comment referencing the pre-move
      `apps/web/e2e/integration/global-setup.ts` path.

## 3. Verify against the pin

- [ ] 3.1 Re-run the test from 1.1 and confirm it now passes with the fixed
      resolution.
- [ ] 3.2 Manually run `pnpm test:e2e:integration` (with `E2E_DATABASE_URL`
      set) and confirm `globalSetup` no longer throws and the reset/seed
      `execSync` calls run with `cwd` inside the workspace.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
