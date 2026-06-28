## 1. Web fix: timezone-correct deadline parsing

- [ ] 1.1 In `apps/web/src/components/admin/periods-tab-dialog.tsx`, fix the
      submit parse in `handleSubmit`: replace `new Date(deadline)` with
      `new Date(\`${deadline}:00.000Z\`)`so the`datetime-local`value is read
    as UTC wall-clock, the exact inverse of the`dateTimeInputValue` display
    (`toISOString().slice(0,16)`).
- [ ] 1.2 In the same file, fix the in-dialog deadline range validation
      (`deadlineError`): parse the deadline with the same `:00.000Z` UTC suffix
      before comparing it against the UTC-parsed `periodStart`
      (`T00:00:00.000Z`) and `periodEnd` (`T23:59:59.999Z`) bounds, so the
      validated instant matches the submitted instant.
- [ ] 1.3 Confirm the existing `periodStart` / `periodEnd` submit parses keep
      their explicit UTC suffixes (`T00:00:00.000Z` / `T23:59:59.999Z`) and are
      not regressed to bare `new Date(value)`; this records the spec invariant.
- [ ] 1.4 Correct the misleading comment on `dateTimeInputValue` that claims the
      round-trip is "stable for the typical European admin case"; state that the
      field is UTC wall-clock on both read and write, stable in every timezone.

## 2. Test

- [ ] 2.1 Add a Vitest unit test (colocated with the dialog, e.g.
      `apps/web/src/components/admin/periods-tab-dialog.test.tsx` or a helper
      test) asserting the deadline display→parse round-trip is byte-stable: a
      stored `Date` rendered via `dateTimeInputValue` then re-parsed with the
      `:00.000Z` suffix yields the identical UTC instant under a non-UTC offset.
- [ ] 2.2 Add a case asserting the range-validation parse and the submit parse
      resolve the same instant for an in-range non-UTC deadline (no false
      "before period start" error).

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` and confirm it passes.
- [ ] 3.2 Run `pnpm lint` and confirm it passes.
- [ ] 3.3 Run `pnpm test` and confirm the new round-trip test passes.
- [ ] 3.4 Run `pnpm build` and confirm it passes.
