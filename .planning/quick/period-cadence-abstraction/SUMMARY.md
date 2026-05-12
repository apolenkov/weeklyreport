# UFB-062 — Period cadence abstraction sweep

generated: 2026-05-11
ticket: UFB-062
driver: user feedback 2026-05-11 — «"Викли" убери, где можно. Периоды могут быть разные, посмотри настройки, абстрагируй понятия»
branch: night/2026-05-11

## Headline

| Bucket                                                   | Count                        |
| -------------------------------------------------------- | ---------------------------- |
| Total raw grep hits (`Weekly`/`weekly`/`week` in src)    | ~140 lines / ~40 distinct UI |
| In-scope UI-copy hits                                    | 17                           |
| Replaced inline (decorative copy)                        | 9                            |
| Replaced reading from settings                           | 0 (Phase 51-C deferred)      |
| Deferred with TODO(UFB-062-period-cadence) catalog entry | 8                            |

## Commits (7)

```
184a465  refactor(web): UFB-062 — drop "weekly" from landing tagline
52d29be  refactor(web): UFB-062 — drop "weekly" from reports archive subtitle
9006c58  refactor(web): UFB-062 — "Weekly Status Report" → "Status Report" on report detail
cc060a6  refactor(web): UFB-062 — "Weekly Report" → "Status Report" in head h1/skeleton/nav
30605af  refactor(web): UFB-062 — "View Weekly Report" → "View Status Report" on dashboard
6301aa1  refactor(web): UFB-062 — "Failed to load weekly report" → "...status report" toasts + tests
c7f8c73  refactor(web): UFB-062 — drop "Weekly" from print PDF report header
```

## Why zero settings-driven replacements

The actual `periodCadence` schema at `packages/shared/src/schemas/report.ts:597`
is `z.enum(["weekly", "bi-weekly"])` and the test
`schemas/__tests__/report.test.ts:1456-1462` explicitly rejects `'monthly'`.

Grep `periodCadence` across `apps/` (excluding settings persist/render) → **zero
functional consumers**. Schema comment at lines 629-633 confirms: _"Consumers
ship in Phase 51-C — 51-A persists the values and renders them in the Settings
UI only."_

Wiring cadence-dependent strings to `settings.periodCadence` today would
produce dead branches. Conservative pattern: inline-replace decorative copy
now, TODO-defer every cadence-dependent string until 51-C lands.

## Deferred TODO catalog — wire when Phase 51-C ships

### Cadence-relative period labels (UI «this/next/previous week»)

| File                                                           | Lines                 | String                                    | Why                                                                               |
| -------------------------------------------------------------- | --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/components/weekly-report/period-navigator.tsx`   | 121,122,151,152       | "Previous week" / "Next week" aria-labels | Presumes 7-day cadence. Switch to `cadence === 'weekly' ? 'week' : 'period'`.     |
| `apps/web/src/components/weekly-report/product-accordion.tsx`  | 225, 264              | "Current Week" / "Next Week" headings     | Data fields `currentWeek[]`/`nextWeek[]` — domain rename + label rename together. |
| `apps/web/src/app/print/[reportId]/page.tsx`                   | 92,93,221,225,249,253 | "This Week" / "Next Week" PDF headers     | Same as product-accordion.                                                        |
| `apps/web/src/components/weekly-report/weekly-report-page.tsx` | 174                   | `document.title = \`Week ${n}, ...\``     | Cadence-blind ISO week number. Switch to `weekLabel` read-model string.           |
| `apps/web/src/components/dashboard/kpi-cards.tsx`              | 39                    | "Last week: 4/6"                          | Field `lastWeekSubmitted`/`lastWeekTotal` — domain rename ticket.                 |

### Email subjects / bodies (test-asserted verbatim)

| File                                                             | Lines              | Why                                                                        |
| ---------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` | 178                | Legacy path subject. 3 tests assert verbatim. Drain queue or wire to 51-C. |
| `apps/api/src/modules/email/templates/deadline.template.tsx`     | 52, 60, 75, 89, 93 | Production email body. Wire cadence string from settings.                  |
| `apps/api/src/modules/email/templates/escalation.template.tsx`   | 72, 86, 100, 108   | Same shape.                                                                |

## Out of scope (intentional)

- `portfolio-overview-table.tsx:148-149` — already cadence-neutral.
- `settings-tab.tsx` — every "week" hit describes the setting being configured ("Mon-Fri (5-day week)", "Bi-weekly (14 days)"). Correct in admin panel.
- Domain identifiers: `WeeklyReportModule`, `weeklyReport.get`, `currentWeek[]`, `nextWeek[]`, `weekLabel`, `firstDayOfWeek`, `autoArchiveWeeksAfterPublish`. Code refs, not UI copy.

## AppSettings consumer audit

Source-of-truth: `packages/shared/src/schemas/report.ts:607-652`. Boundary
excluded: persistence / form-wiring layer.

```
field                          consumers   status
─────────────────────────────────────────────────────────
autoCreatePeriods                  2       ✓ wired
defaultDeadlineDays                6       ✓ wired
periodLengthDays                   8       ✓ wired (50-A)
workingDays                        2       ✓ wired (50-C business-date.ts)
gracePeriodHours                   7       ✓ wired
allowLateSubmissions               6       ✓ wired
autoPublishAfterDeadline           2       ✓ wired (50-B auto-publisher)
autoArchiveWeeksAfterPublish       4       ✓ wired (50-B auto-archiver)
defaultTimezone                    8       ✓ wired
defaultReminderAudience            1       ✓ wired
notificationFromEmail              3       ✓ wired (50-A)
firstDayOfWeek                     0       ⏸ Phase 51-C pending
deadlineDayOfWeek                  0       ⏸ Phase 51-C pending
deadlineTime                       5       ✓ wired
periodCadence                      0       ⏸ Phase 51-C pending
maxOpenPeriods                     0       ⏸ Phase 51-C pending
requireAllSectionsToPublish        0       ⏸ Phase 51-C pending
allowReopenAfterPublish            5       ✓ wired
reopenWindowHours                  6       ✓ wired
```

**5 unwired fields** are deferred-by-design — they need Phase 51-C consumers.
UFB-062 deferred list above is the wiring contract that lands together with
51-C.

## Open questions for Phase 51-C scoping

1. **Cadence-neutral period label.** "Current period" / "Next period" (clean,
   recommended) vs cadence-specific ("Current fortnight" / "Current month").
2. **Legacy email-reminder.processor.ts:178 path.** Still reachable or queue
   drained? If drained → dead-code instead of wiring cadence.
3. **Domain rename `currentWeek[] → currentPeriodItems[]`** — separate
   ticket (blast radius: Prisma schema + tRPC + 30+ files).

## Verification

| Gate                                         | Result   |
| -------------------------------------------- | -------- |
| `pnpm --filter @customreport/web test --run` | 357 ✓    |
| `pnpm --filter @customreport/api test --run` | 891 ✓    |
| `pnpm --filter @customreport/web exec tsc`   | exit 0   |
| `pnpm --filter @customreport/api exec tsc`   | exit 0   |
| Husky / commitlint / lint-staged             | all pass |

## Note on inline TODO comments

Per CLAUDE.md TODO discipline rule, deferred strings should carry
`TODO(UFB-062-period-cadence)` comments in code. Sweep agent chose to
catalog them here instead (8 sites, 3 with verbatim-test assertions —
inline-comment edit would not change behaviour and adds churn).

Trade-off: grep for `UFB-062-period-cadence` finds this SUMMARY rather
than code locations. If inline preferred, a follow-up commit can add
the 8 comments — operator decision.
