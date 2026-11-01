# Tasks

- [x] 1. RED: failing tests in `mutation-audit.bounds.test.ts` (25-identity
      cap, self-referencing input, depth-8 bound with a depth-4 control) and
      in `audit-logger.test.ts` (mutation envelope `truncated`), plus the
      within-limits characterization.
- [x] 2. GREEN: bounded walk (20 targets / 8 levels / visited set) in
      `trpc.audit.ts`, `truncated` on `MutationInput` and on the mutation
      event emission.
- [x] 3. Validate the change:
      `openspec validate bound-audit-target-extraction --strict`.
- [x] 4. Focused checks: focused vitest (mutation-audit, trpc.logging,
      audit-logger), prettier, eslint, typecheck, `git diff --check`. The
      full six repo gates run on the final SHA by the coordinator before
      push.
