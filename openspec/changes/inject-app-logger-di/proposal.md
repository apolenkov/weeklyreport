## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`AdminService`, `PdfExportService`, and `RemindersService` are all
constructed by their Nest module factories with `logger` left `undefined`,
so each service falls back to its own `createNullLogger()` default. That
silently drops every `info`/`debug` operational log line the services emit
in production: period create/update/delete and reminder-policy application
in `AdminService`, PDF snapshot/enqueue in `PdfExportService`, and
dedup/enqueue/mark-sent in `RemindersService`. `ConfigModule` already
provides and exports the `APP_LOGGER` token, and `period.module.ts` already
injects it into every scheduler factory it wires — the pattern exists, it is
simply not applied to these three modules. (PDF-export failure visibility is
preserved separately by the pdf-export worker's own real logger and metric,
so this change only restores the missing info-level operational lines, not
error reporting.)

## What Changes

- `apps/api/src/modules/admin/admin.module.ts`: change the `AdminService`
  provider from a bare `useClass`-equivalent construction to a `useFactory`
  that also injects `APP_LOGGER` and passes it as the service's `logger`
  argument, mirroring the `useFactory`/`inject` shape already used for
  `PeriodService` in `period.module.ts`.
- `apps/api/src/modules/pdf-export/pdf-export.module.ts`: add `APP_LOGGER`
  to the `PdfExportService` factory's `inject` array and pass it as the
  second constructor argument (currently hard-coded `undefined`).
- `apps/api/src/modules/reminders/reminders.module.ts`: add `APP_LOGGER` to
  the `RemindersService` factory's `inject` array and pass it as the second
  constructor argument (currently hard-coded `undefined`).
- Each of the three modules imports `ConfigModule` (already imported by
  `pdf-export.module.ts`/`reminders.module.ts` transitively is not
  sufficient — `ConfigModule` must be an explicit `imports` entry wherever
  `APP_LOGGER` is injected) so Nest can resolve the token.

## Capabilities

### New Capabilities

- `operational-logger-wiring`: DI factories for services with operational
  (non-audit) logging MUST inject the shared `APP_LOGGER` token instead of
  leaving the constructor's optional logger argument unset.

### Modified Capabilities

(none)

## Impact

- `apps/api/src/modules/admin/admin.module.ts`
- `apps/api/src/modules/pdf-export/pdf-export.module.ts`
- `apps/api/src/modules/reminders/reminders.module.ts`

Non-goals: no change to `AdminService`, `PdfExportService`, or
`RemindersService` themselves (their constructors already accept an
optional `AppLogger` and already fall back to a null logger when none is
given — that fallback stays, e.g. for unit tests that construct the service
directly); no change to the pdf-export worker's own logger/metric wiring;
no change to `period.module.ts`, which already does this correctly.
