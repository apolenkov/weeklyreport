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

- [ ] 2.1 Add a component regression that drives the REAL dialog submit path,
      not a detached display/parse helper. Extend the existing
      `apps/web/src/components/admin/periods-tab.test.tsx` suite (which already
      captures `admin.updatePeriodManual` payloads via its `captured` harness)
      and exercise the actual `PeriodsTab` → `CreatePeriodDialog` edit-submit
      flow with `userEvent`. Open the edit dialog on a row whose stored
      deadline is a non-midnight UTC instant and submit WITHOUT touching the
      deadline field; assert the captured `deadline` payload is byte-identical
      to the original stored ISO instant (no -N-hour drift).
- [ ] 2.2 Force a non-UTC process timezone for the regression so the old
      `new Date(deadline)` local parse would actually fail. Set `process.env.TZ`
      to a non-UTC zone (e.g. `Europe/Moscow`, UTC+3) before the test body — via
      a `beforeAll`/`afterAll` restore or a per-file `vi.stubEnv('TZ', …)` — and
      confirm the default UTC test process is no longer relied on to pass. A
      detached parser-only assertion is NOT sufficient; the bug must be provable
      through the dialog submit path.
- [ ] 2.3 Add a case asserting the in-dialog range validation and the submit
      parse resolve the SAME instant for an in-range non-UTC deadline: under the
      non-UTC timezone, enter an early-in-day deadline that is in range only
      when parsed as UTC, and assert no "Deadline cannot be before period start"
      error is shown AND the deadline reaches the captured submit payload as the
      UTC-parsed instant.

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` and confirm it passes.
- [ ] 3.2 Run `pnpm lint` and confirm it passes.
- [ ] 3.3 Run `pnpm test` and confirm the new round-trip test passes.
- [ ] 3.4 Run `pnpm build` and confirm it passes.
