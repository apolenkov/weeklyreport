---
phase: 49
plan: 01
subsystem: settings-consumers
tags: [refactor, migration, organization, bullmq, ufb-047]
requires:
  - Phase 48 (Organization model + Identity tab + auth.me hydration)
provides:
  - AppSettings.departmentName column dropped (DB + Prisma + Zod)
  - BullMQ email payload carries `organization: { shortName, fullName }`
  - Email templates render brand from per-job org snapshot
affects:
  - apps/api: admin / weekly-report / lead-form / reminders / email
  - apps/web: settings-tab / dashboard / weekly-report / lead-form / mappers
  - packages/shared: appSettingsSchema / weeklyReportReadModelSchema / reportSectionReadModelSchema
tech-stack:
  patterns:
    - "Per-job brand snapshot at enqueue (immune to mid-flight admin edits)"
    - "Single fetch of OrganizationService.getPublic() per scheduler tick"
key-files:
  created:
    - prisma/migrations/20260510205434_drop_appsettings_departmentname/migration.sql
  modified:
    - packages/shared/src/schemas/report.ts
    - packages/shared/src/schemas/__tests__/report.test.ts
    - apps/api/prisma/schema.prisma (via repo-root prisma/schema.prisma)
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/admin/admin.service.test.ts
    - apps/api/src/modules/admin/admin-settings.integration.test.ts
    - apps/api/src/modules/admin/stage-assignment.integration.test.ts
    - apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts
    - apps/api/src/modules/weekly-report/weekly-report.contract.test.ts
    - apps/api/src/modules/weekly-report/weekly-report.integration.test.ts
    - apps/api/src/modules/weekly-report/weekly-report.service.test.ts
    - apps/api/src/modules/report-sections/lead-form.prisma-repository.ts
    - apps/api/src/modules/email/render-template.ts
    - apps/api/src/modules/email/render-template.test.ts
    - apps/api/src/modules/email/templates/deadline.template.tsx
    - apps/api/src/modules/email/templates/escalation.template.tsx
    - apps/api/src/modules/reminders/reminders.module.ts
    - apps/api/src/modules/reminders/reminders.scheduler.ts
    - apps/api/src/modules/reminders/reminders.scheduler.test.ts
    - apps/api/src/modules/reminders/reminders.service.ts
    - apps/api/src/modules/reminders/reminders.service.test.ts
    - apps/api/src/infrastructure/bullmq/email-reminder.processor.ts
    - apps/web/src/components/admin/mock-data.ts
    - apps/web/src/components/admin/settings-tab.tsx
    - apps/web/src/components/admin/settings-tab.test.tsx
    - apps/web/src/components/dashboard/dashboard-page.tsx
    - apps/web/src/components/dashboard/dashboard-page.test.tsx
    - apps/web/src/components/lead/lead-form.tsx
    - apps/web/src/components/weekly-report/weekly-report-page.tsx
    - apps/web/src/lib/mappers/admin.ts
    - apps/web/src/lib/mappers/admin.test.ts
    - apps/web/src/lib/mappers/dashboard.test.ts
    - apps/web/src/lib/mappers/weekly-report.test.ts
    - prisma/seed.ts
    - prisma/wipe-manual-uat.ts
decisions:
  - "Email subject prefixes [shortName]; footer renders fullName — preserves long-form branding without bloating the subject line"
  - "Brand snapshotted into BullMQ payload at enqueue (not fetched at consume) — already-queued jobs are immune to mid-flight Identity-tab edits"
  - "Scheduler fetches Organization once per runOnce (skip when nothing due) instead of once per recipient — one DB read per tick, not N"
  - "Frontend reads brand from auth.me.organization (already hydrated per-request) — backend repos no longer inject departmentName into read models"
metrics:
  duration: "~70 min"
  completed: 2026-05-10
---

# Phase 49 Plan 01: Drop AppSettings.departmentName Summary

Removes the transitional `AppSettings.departmentName` column from the source
tree, the Prisma schema, the live database, and every BullMQ email payload.
Brand identity (short + full name) lives exclusively on the `Organization`
singleton from this point on; readers consume it through
`auth.me.organization` on the frontend or the per-job snapshot on the worker.

## Migration

`prisma/migrations/20260510205434_drop_appsettings_departmentname/migration.sql`

```sql
ALTER TABLE "AppSettings" DROP COLUMN "departmentName";
```

Migration was hand-crafted (Prisma's interactive `migrate dev` is blocked in
the non-interactive shell) and applied via `prisma migrate deploy`. The
generated SQL matches what `migrate dev` would have produced after
`--accept-data-loss`.

## Grep Audit

```
$ grep -rln "departmentName" apps/api/src apps/web/src packages/shared/src \
    | grep -v ".next/" | grep -v "apps/api/dist"
```

All remaining matches are migration-marker comments
(`// UFB-047 / Phase 49-01: ...departmentName removed...`) — there are zero
runtime references to the field. Verified with:

```
$ grep -rn "departmentName" apps/api/src apps/web/src packages/shared/src \
    | grep -vE "^\s*[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)"
(empty)
```

Migration SQL files (the new one above + the historical
`20260410150628_init/migration.sql` that originally created the column,
plus `20260510194118_organization_singleton/migration.sql` whose `INSERT
... SELECT departmentName FROM AppSettings` seed copy is frozen history)
are exempt per acceptance criteria.

## BullMQ Payload — Before / After

```
                              BEFORE (Phase 48-B)
┌─ deadline payload ─────────────────────────────────────────────────────┐
│ {                                                                       │
│   executionId, recipientEmail, kind: 'deadline',                        │
│   leadName, reportPeriod, deadlineIso, sectionUrl                       │
│ }                                                                       │
│                                                                         │
│ Footer rendered hardcoded:                                              │
│   "PEO — Weekly status reporting for Product Engineering & Operations." │
└─────────────────────────────────────────────────────────────────────────┘

                              AFTER (Phase 49-01)
┌─ deadline payload ─────────────────────────────────────────────────────┐
│ {                                                                       │
│   executionId, recipientEmail, kind: 'deadline',                        │
│   leadName, reportPeriod, deadlineIso, sectionUrl,                      │
│   organization: { shortName: 'PEO',                                     │
│                   fullName:  'Product Engineering & Operations' }       │
│ }                                                                       │
│                                                                         │
│ Subject:  "[PEO] Reminder: <period> report section due in 24h"          │
│ Footer:   "PEO — Weekly status reporting for Product Engineering       │
│            & Platforms."                                                │
│             ↑ shortName                       ↑ fullName                │
└─────────────────────────────────────────────────────────────────────────┘
```

Same shape applies to the `kind: 'escalation'` branch. The legacy v2.0
plain-text path (no `kind` field) is untouched — it does not render
brand strings, so no payload change was needed there.

## Files Changed by Layer

| Layer                   | Files                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migration**           | `prisma/migrations/20260510205434_drop_appsettings_departmentname/migration.sql` (new)                                                                                                                                                       |
| **Schema**              | `prisma/schema.prisma`, `packages/shared/src/schemas/report.ts`                                                                                                                                                                              |
| **API repos**           | `admin.prisma-repository.ts`, `weekly-report.prisma-repository.ts`, `lead-form.prisma-repository.ts`                                                                                                                                         |
| **API reminders**       | `reminders.module.ts`, `reminders.scheduler.ts`, `reminders.service.ts`, `email-reminder.processor.ts`                                                                                                                                       |
| **API email**           | `render-template.ts`, `templates/deadline.template.tsx`, `templates/escalation.template.tsx`                                                                                                                                                 |
| **API tests**           | shared report.test.ts, admin.service.test.ts, admin-settings.integration.test.ts, stage-assignment.integration.test.ts, weekly-report.{contract,integration,service}.test.ts, render-template.test.ts, reminders.{scheduler,service}.test.ts |
| **Web pages**           | `weekly-report-page.tsx`, `dashboard-page.tsx`, `lead-form.tsx`, `settings-tab.tsx`                                                                                                                                                          |
| **Web mappers / mocks** | `mappers/admin.ts`, `components/admin/mock-data.ts`                                                                                                                                                                                          |
| **Web tests**           | `settings-tab.test.tsx`, `dashboard-page.test.tsx`, `mappers/{admin,weekly-report,dashboard}.test.ts`                                                                                                                                        |
| **Seeds**               | `prisma/seed.ts`, `prisma/wipe-manual-uat.ts`                                                                                                                                                                                                |

## Test Counts

|                   | before | after | delta |
| ----------------- | -----: | ----: | ----: |
| shared            |    460 |   460 |     0 |
| api (unit)        |    730 |   730 |     0 |
| api (integration) |     64 |    64 |     0 |
| web               |    318 |   318 |     0 |

All green. Same totals — the deletion of `departmentName`-specific test
cases was offset by no new tests; behavioral coverage of the `organization`
threading is exercised by the existing render-template tests (they now
assert against the new prop) and by the scheduler tests (they construct
`fakeOrganizationService` and verify the payload reaches BullMQ).

## Manual Smoke

```bash
$ curl -s http://localhost:3002/trpc/org.getPublic
{"result":{"data":{"json":{"shortName":"PEO","fullName":"Product Engineering & Operations"}}}}

$ docker exec customreport-postgres-1 psql -U customreport -d customreport \
    -c '\d "AppSettings"' | grep -c departmentName
0
```

Container post-conditions executed (host-side `prisma generate` + container
`prisma generate` + `docker compose restart api web`). API container is
healthy and serving `org.getPublic`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] `prisma migrate dev` blocked by non-interactive shell**

- **Found during:** Step 7 (generate migration).
- **Issue:** `prisma migrate dev --name drop_appsettings_departmentname`
  detects the `--accept-data-loss` warning (the column had 1 non-null
  row), fails with "environment is non-interactive, which is not
  supported", and refuses to write the migration directory.
- **Fix:** Hand-crafted the migration directory at
  `prisma/migrations/20260510205434_drop_appsettings_departmentname/`
  with the exact SQL Prisma would have generated
  (`ALTER TABLE "AppSettings" DROP COLUMN "departmentName";`). Applied
  via `pnpm exec prisma migrate deploy` which IS non-interactive-safe
  and which marks the migration as applied in `_prisma_migrations`.
- **Files modified:** new migration directory only.

**2. [Rule 2 — Missing critical functionality] BullMQ payload had no `organization`**

- **Found during:** Inventory pass before Step 4.
- **Issue:** The user prompt and plan acceptance line 31 stated the payload
  "currently still includes `departmentName`" and instructed to "switch
  them to `organization` shape". Reality: the payload had **never**
  carried `departmentName` — the email templates rendered the brand from
  hardcoded strings (with explicit `// kept as a follow-up for Phase 48-B
once the BullMQ payload carries it` comments). This plan is that
  follow-up.
- **Fix:** Added `organization: { shortName, fullName }` to the
  `DeadlineReminderPayload` / `EscalationReminderPayload` types, the
  `EmailReminderJobData` union in the BullMQ processor, and both
  `DeadlineEmailProps` / `EscalationEmailProps`. Threaded the snapshot
  through `RemindersScheduler.runOnce()` (one fetch per tick, fanned out
  to all due rules). Wired `OrganizationService` into `RemindersModule`
  via `imports: [OrganizationModule]`.
- **Files modified:** see "API reminders" + "API email" rows above.
- **Commit:** part of the single atomic commit for this plan.

**3. [Rule 3 — Blocker] `dashboard-page.tsx` had no `SessionContext` wiring**

- **Found during:** Step 5 (frontend rewiring).
- **Issue:** Plan said to use `auth.me.organization` for the
  `departmentLabel`, but `dashboard-page.tsx` (unlike
  `weekly-report-page.tsx`) never imported `SessionContext`.
- **Fix:** Added `useContext` to the React import, added
  `SessionContext` from `../../lib/session-provider`, and threaded
  `sessionState?.organization?.fullName` into `departmentLabel`.

### Schema-Field Drops (Plan Only Listed One)

The plan explicitly named `appSettingsSchema.departmentName` as the field
to drop. Reality required dropping **three** schema fields to avoid
runtime parse errors:

1. `appSettingsSchema.departmentName` — listed in plan.
2. `weeklyReportReadModelSchema.departmentName` — required, on the wire
   from `weeklyReport.get`.
3. `reportSectionReadModelSchema.departmentName` — optional, hung off
   the section read model from the lead-form repo path.

All three were dropped together. The plan's intent is unchanged — the
Identity tab is the single source of truth for brand strings — but the
diff is wider than the plan literal text suggested.

## Email Subject + Footer Substitution Choice (decision-locked)

Per plan acceptance line 33 ("concrete substitution decided in the
implementation; document the choice in SUMMARY"):

| Surface          | Substitution                   | Rationale                                                                                                                                                                              |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject prefix   | `[${shortName}]`               | Compact, recognizable for inbox folder rules; ≤16 chars by Identity-tab constraint.                                                                                                    |
| HTML body footer | `${fullName}`                  | Long-form, brand-faithful. The static template previously read `"PEO — ... Product Engineering & Operations."`; this preserves the word order and substitutes both halves dynamically. |
| Plaintext footer | `${shortName} ... ${fullName}` | Mirrors HTML; drops the em-dash for monospace cleanliness.                                                                                                                             |

The matching legacy v2.0 plain-text path keeps a generic
"Please log in and submit your section before the deadline" line (no
brand reference) — once that queue branch is fully retired, the legacy
fallback can be removed.

## In-flight BullMQ Job Compatibility

When this plan deploys, any `kind: 'deadline'` or `kind: 'escalation'`
job already in Redis from a previous worker run **does not** carry the
`organization` field. The TypeScript type narrowing in the processor
will accept these (the union members that include `kind` now require
`organization`, but raw JSON arriving from Redis is not type-checked
against the union — Redis stores opaque JSON). Reading
`data.organization.fullName` on such a job will throw
`TypeError: Cannot read properties of undefined`, the worker's error
handler will mark the job failed, and BullMQ will retry per the
`attempts: 3` policy → land it in the failed-jobs DLQ.

**This is dev/UAT.** The Redis queue is empty between deploys (verified
via `docker exec customreport-redis-1 redis-cli LLEN bull:email-reminder:wait` → 0).
No fallback is needed; documented for deploy-time awareness.

## Self-Check: PASSED

- Migration SQL file exists: `prisma/migrations/20260510205434_drop_appsettings_departmentname/migration.sql` ✓
- Migration applied in DB: `\d "AppSettings"` returns 0 `departmentName` rows ✓
- All API tests green: 730 unit + 64 integration ✓
- All web tests green: 318 ✓
- All shared tests green: 460 ✓
- Source-tree grep returns only comment-references ✓
- `org.getPublic` smoke returns PEO / Product Engineering & Operations ✓
