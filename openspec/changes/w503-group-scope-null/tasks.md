# Tasks

## 1. API guard

- [x] 1.1 Extend `group-scope.test.ts` to reject both null and undefined, with
      valid-role controls; capture RED from `pnpm --filter @weeklyreport/api exec vitest run src/lib/group-scope.test.ts`.
- [x] 1.2 Add the explicit null absence check and input type; verify the same
      focused test command is GREEN with the existing diagnostic.

## 2. Verification and handoff

- [x] 2.1 Run `pnpm exec eslint apps/api/src/lib/group-scope.ts apps/api/src/lib/group-scope.test.ts --max-warnings 0`,
      `pnpm exec prettier --check apps/api/src/lib/group-scope.ts apps/api/src/lib/group-scope.test.ts openspec/changes/w503-group-scope-null`,
      `openspec validate w503-group-scope-null --strict`, and `git diff --check`;
      deliver the exact diff, file hashes and bounded evidence to the wave author.

## Workflow follow-up

- Wave author runs the six repository gates and independent reviews on the
  consolidated source SHA before integration.
