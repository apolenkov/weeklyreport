# Task 1.1 — Report.deadline consumer audit (2026-07-24)

Grep-verified; "decision deadline" (Decision.deadline field) is a DIFFERENT
column and is explicitly out of scope. Defined null-deadline behavior per
consumer:

## api

| Consumer                                                                                                                                    | Today                                      | With `deadline: null`                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report-sections.service.ts` deadline gate (`getReportMeta`)                                                                                | gates on `meta.deadline`                   | `meta.deadline === null` → gate inactive, log `deadline-gate skipped: period has no deadline` at info                                                       |
| `auto-publisher.scheduler.ts`                                                                                                               | publishes at `deadline + grace`            | null → period is NEVER auto-published; surfaced in scheduler log line per tick (debug)                                                                      |
| `period-creator.scheduler.ts` / `period-factory.ts`                                                                                         | computes deadline for auto-created periods | unchanged — auto-created periods ALWAYS carry a deadline; null enters only via admin edit                                                                   |
| `reminders-due-rules.prisma-query.ts` + `policy-applicator.service.ts`                                                                      | deadline-relative rules compute due times  | SQL/rule filter excludes null-deadline reports — no executions; unit-pinned                                                                                 |
| `reminders-dedupe-key.ts`, `reminders-queue-payload.ts`, email templates (`deadline.template`, `escalation.template`, `render-template.ts`) | format deadline                            | unreachable for null (due rules exclude upstream); templates additionally throw ReminderDomainError on null label (existing requireRulePeriodLabel pattern) |
| `admin` period envelope/lifecycle/queries                                                                                                   | pass-through Date                          | type widens to `Date \| null`; overlap/validation untouched (deadline not part of overlap math)                                                             |
| `weekly-report` read model, `pdf-export`, `published-report-snapshot`                                                                       | render/pass deadline                       | render "No deadline" / omit row; types widen                                                                                                                |
| `audit-logger-types.ts` (`PeriodManualCreateInput`/`PeriodManualEditInput`)                                                                 | `deadline: string`                         | edit event: `changes.deadline: { from: string; to: string \| null }`; create keeps required (creation always sets one)                                      |
| `metrics.registry.ts`                                                                                                                       | none deadline-specific                     | n/a                                                                                                                                                         |

## packages/shared

- `period.schema.ts` (admin update wire): `deadline` → `.nullable().optional()`
  — absent = untouched, null = clear, value = set. Create schema unchanged
  (required).
- `report.schema.ts` / `report-primitives.schema.ts`: read-model `deadline`
  → nullable; three-state pinned by schema-surface test.
- `time.ts`: formatters gain explicit null branch (return "No deadline")
  only where a call site can now receive null.

## web

- `periods-tab-dialog*` (admin edit form): clear affordance; empty string in
  edit mode → `deadline: null` in payload; confirm dialog states "This
  period will have no deadline; reminders and auto-publish will not run."
- `kpi-cards.tsx` / `dashboard-kpi.ts`: countdown → explicit "No deadline"
  state.
- `settings-periods-fields-*`: cycle preview unchanged (creation path).
- lead-form/report-pages fixtures: type widening only.

## prisma

- `Report.deadline DateTime` → `DateTime?`; single init migration hand-edit +
  `migrate reset`; seeds keep non-null deadlines (dashboards stay realistic),
  one seeded archived period gets null to exercise render paths.

## Rejected alternative

Sentinel far-future date instead of null — rejected: it is exactly the
silent-default pattern the standard bans, and it corrupts KPI math.
