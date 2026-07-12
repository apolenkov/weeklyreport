## 1. Print template terminal states

- [ ] 1.1 `print-report-template.tsx`: define a single source of truth for the
      three render-outcome tokens (`loading`, `error`, `ready`) and stamp them on
      the root element of each returned branch as `data-print-state="…"`
- [ ] 1.2 Tag the existing `LoadingShell` return (`weeklyQ.isLoading`) with
      `data-print-state="loading"`
- [ ] 1.3 Replace the `no-period` sentinel branch and add an `weeklyQ.isError`
      branch: both return a distinct, visible terminal error state (NOT
      `LoadingShell`) with `data-print-state="error"`, stating the report could
      not be rendered. UI strings stay English
- [ ] 1.4 Tag the successful render path's root element with
      `data-print-state="ready"`
- [ ] 1.5 Keep the `toast.error` effect for the interactive case; it is no longer
      the sole failure signal

## 2. PDF worker readiness contract

- [ ] 2.1 `pdf-export.processor.ts`: after `page.goto` (networkidle) and BEFORE
      `page.pdf()`, wait for `[data-print-state="ready"]` with a bounded timeout
      (a named constant, in the style of `PAGE_GOTO_TIMEOUT_MS`)
- [ ] 2.2 If `[data-print-state="error"]` is present, or the ready marker does
      not appear within the timeout, throw — do NOT call `page.pdf()`,
      `writeFileSync`, or `markExportCompleted`
- [ ] 2.3 Confirm the thrown error routes through the existing
      `onJobFailed → markExportFailed` path (`markExportCompleted` runs only after
      the ready assertion passes)
- [ ] 2.4 Keep the `data-print-state` token strings identical to the web template's;
      document the cross-file coupling with a short WHY comment on the worker side

## 3. Spec delta

- [ ] 3.1 Add the `pdf-export-integrity` capability: the print template exposes
      machine-detectable render-outcome states, and the worker asserts a positive
      readiness contract before capture

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test` — all green
- [ ] 4.3 Fail-injection check: force `weeklyReport.get` to error, drive an export,
      and confirm the job ends in `markExportFailed` (not a completed spinner PDF)
- [ ] 4.4 Success check: a normal export still reaches `[data-print-state="ready"]`
      and records `markExportCompleted` with a valid sha256
- [ ] 4.5 `grep -nE '[а-яА-Я]' apps/web/src/app/print/[reportId]/print-report-template.tsx` — every hit is data/comment/test
- [ ] 4.6 `npx openspec validate print-error-state-and-pdf-readiness --strict`
