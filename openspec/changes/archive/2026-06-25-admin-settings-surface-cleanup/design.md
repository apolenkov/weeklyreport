# Design — admin-settings-surface-cleanup

## Context

Live page feedback on `/admin?tab=settings`. The terms used here follow
`CONTEXT.md`: **Period policy** (the Settings → Periods org-wide defaults +
automation switches) versus **Period management** (the Admin → Periods
per-instance CRUD tab). The two are complementary, not duplicates — that
distinction is the resolution of the "how do these correlate?" feedback.

## Key finding that shaped the change (verify-don't-trust)

The code comments in the Periods sub-tab claim "values only round-trip /
consumers ship in Phase 51-C". That is **stale**. Grepping the API for each of
the 15 period-policy fields shows 11 have live consumers:

| Field                                                                 | Live consumer                                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| autoCreatePeriods, periodLengthDays, defaultDeadlineDays, workingDays | `period-creator.scheduler.ts`                                                                                              |
| autoPublishAfterDeadline, gracePeriodHours                            | `auto-publisher.scheduler.ts`                                                                                              |
| autoArchiveWeeksAfterPublish                                          | `auto-archiver.scheduler.ts`                                                                                               |
| allowLateSubmissions, gracePeriodHours                                | `report-sections.service.ts` (request-path gate)                                                                           |
| allowReopenAfterPublish, reopenWindowHours                            | `period.service.ts` (request-path gate)                                                                                    |
| deadlineTime                                                          | `period-admin.service.ts` — manual create only, whole-hour (minutes stripped); the auto-creation scheduler hardcodes 18:00 |

Only four appear **solely** in `admin-settings.queries.ts` (read/write) plus
tests, with no consumer: `firstDayOfWeek`, `deadlineDayOfWeek`, `maxOpenPeriods`,
`requireAllSectionsToPublish`. Those are the genuine dead knobs.

Three of the eleven "working" fields have copy that is not merely stale but
factually backwards, surfaced in Codex round 1 and confirmed against code:

- **Late-submission semantics are reversed.** `report-sections.service.ts` always
  honors the grace window and rejects only AFTER grace when
  `allowLateSubmissions=false`. The current copy says "off" makes the deadline
  immediately hard — the opposite. Corrected copy is part of the honesty goal.
- **Auto-publish has a false UI dependency.** The checkbox is disabled unless
  `autoCreatePeriods` is on, but `auto-publisher.scheduler.ts` reads only
  `autoPublishAfterDeadline`. Drop the `disabled` guard + the "Requires
  «Auto-create periods»" note (a 2-line UI honesty fix, not a behavior change to
  the backend).
- **`deadlineTime` is whole-hour + manual-only.** Describe it honestly rather than
  expand scope to wire minute precision through the scheduler.

## Decisions

1. **Remove the 4 dead fields fully, including the `AppSettings` columns.**
   Per the repo MVP rule the DB is disposable and the schema is reshaped
   directly (no incremental alter-table migration): edit `schema.prisma`, hand-
   sync the single init migration SQL, `prisma migrate reset`. Keeping the
   columns "for later" would re-create the half-working-UI defect this change
   exists to remove. Full blast radius (enumerated in tasks): form, mutate
   payload, shared schema/type, read DTO + PATCH writer in
   `admin-settings.queries.ts`, web mappers + `MockSettings`, Prisma model + init
   migration, **both seed programs** (`prisma/seed.ts`, `prisma/seed-simple.ts`
   write all four columns — omitting them breaks `migrate reset` + seed), and the
   settings + scheduler test fixtures.

2. **Rename the period-policy save copy to "Period policy."** The button + toast
   say "Period settings"; CONTEXT.md reserves "period policy" for the org rules.
   Rename the user-facing strings and the `e2e/catalog/admin.yaml` intent.

3. **Update the durable scenario catalog.** `e2e/catalog/admin.yaml` still
   asserts the four removed controls and the CI / Slack / "AI Summary" cards;
   update both affected scenarios or the pre-push catalog-drift gate trips.

4. **Rewrite the stale help text on the 11 working fields; leave the BACKEND
   behavior untouched.** The defect is the copy, not the wiring. This includes the
   auto-publish "Scheduler logic is deferred … cron consumer arrives in a
   follow-up plan" line and the reopen "Window enforcement ships in Phase 51-C"
   line, both of which contradict shipped code. The one UI-behavior change is
   removing the false `disabled={!autoCreatePeriods}` restriction on the
   auto-publish checkbox (below) — the backend already treats the two flags
   independently, so this aligns the UI to existing backend behavior rather than
   changing it.

5. **CI removal goes one layer into the API.** `integrationsStatusSchema` is
   already `telegram`-only, so the contract needs no change; but the router
   returns an undocumented `ci` sibling built from `CI_WEBHOOK_SECRET`. Drop the
   `ci` return branch, the `CI_WEBHOOK_SECRET` read, and the component's `ci`
   destructure + its `no-unnecessary-condition` eslint-disable. Slack is
   UI-only — just delete the card.

6. **AI card is reframed, not activated.** Rename "AI Summary" → "AI", widen the
   copy to "provider/model selection applied to all AI features (summary, risk
   extraction, RAG)", keep the Coming-Soon badge and the placeholder
   provider/RAG rows. Because it stays Coming-Soon with no activation, no content
   leaves the system and there are no provider/data-residency/credential
   decisions in scope here.

7. **Holidays restyle keeps the deferred semantics.** Replace the outlined-pill
   / fixed-width Calendar classes on the inert `<span>` with the same text
   treatment the sibling triggers use, so the `line`-variant underline applies
   uniformly. Keep the `ComingSoonTooltip` wrapper, the `sr-only`
   `ComingSoonBadge` (the spec-mandated accessible name), and the
   `data-testid`. The Calendar icon is dropped (no sibling carries an icon). The
   pre-existing nuance that the trigger is selectable while the span is inert is
   unchanged and out of scope.

## No ADR

The durable decision (Period policy vs Period management) is captured as
glossary terms in `CONTEXT.md`. Removing four speculative columns on a
disposable MVP DB is routine, not a hard-to-reverse architectural choice, so it
stays a change-scoped decision here rather than an ADR.

## Risks

- Removing columns breaks any fixture that constructs a full `AppSettings`
  object. Mitigation: the tasks list each test file that seeds the four fields;
  the typecheck gate catches the rest.
- A future "first day of week" / "max open periods" feature would re-add the
  column. Accepted: re-adding a column on a disposable DB is cheap, and shipping
  honest UI now beats holding dead inputs for a hypothetical.
