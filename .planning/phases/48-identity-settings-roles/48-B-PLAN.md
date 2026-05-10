# Phase 48-B — Settings Expansion

**Status:** ready
**Depends on:** 48-A (tabbed Settings layout, Identity tab)
**Requirement:** Гибкая настраиваемая система — что админ хочет
поменять без deploy

## Goal

Add 9 new configurable fields to `AppSettings` (the org-wide behavior
config) and surface them in three new Settings tabs (Periods, Reminders,
Notifications). All fields nullable / defaulted so existing rows stay
valid. After this plan: admin opens Settings → choose tab → tweak
period length, working days, grace period, default timezone for
ReminderPolicies, notification from-email, auto-publish toggle, etc.

## Acceptance Criteria

- 9 new fields on `AppSettings`:

  | поле                           | тип / enum                           | default         |
  | ------------------------------ | ------------------------------------ | --------------- |
  | `periodLengthDays`             | int (1..31)                          | 7               |
  | `workingDays`                  | enum mon-fri \| mon-sat \| mon-sun   | mon-fri         |
  | `gracePeriodHours`             | int (0..168)                         | 24              |
  | `defaultTimezone`              | string IANA                          | Europe/Moscow   |
  | `defaultReminderAudience`      | enum lead-with-draft \| head-of-late | lead-with-draft |
  | `notificationFromEmail`        | string email nullable                | null            |
  | `allowLateSubmissions`         | bool                                 | true            |
  | `autoPublishAfterDeadline`     | bool                                 | false           |
  | `autoArchiveWeeksAfterPublish` | int (0..52, 0=never)                 | 0               |

- One migration `<timestamp>_appsettings_expansion` adds all 9 columns
  with defaults (so the existing singleton row is updated to defaults
  via `ALTER TABLE … ADD COLUMN … DEFAULT … NOT NULL` semantics; nullable
  for notificationFromEmail).

- Shared zod `appSettingsSchema` extended with all 9 fields; defaults
  match SQL defaults.

- tRPC `admin.getSettings` / `admin.updateSettings` round-trip all 9
  new fields; existing payload shape preserved.

- Settings UI gains three tabs:
  - **Periods**: periodLengthDays, workingDays, defaultDeadlineDays
    (existing), autoCreatePeriods (existing), gracePeriodHours,
    allowLateSubmissions, autoPublishAfterDeadline,
    autoArchiveWeeksAfterPublish.
  - **Reminders**: defaultTimezone (reuse TIMEZONE_OPTIONS from
    UFB-035), defaultReminderAudience.
  - **Notifications**: notificationFromEmail.

- Each new field has a one-line help text below the input (the «зачем»).

- 3 product semantics baked in this plan (resolved with user, defaults):
  - `workingDays` is **metadata only** in v1 — does NOT change deadline
    calculation. Documented in field help text: «влияет на UI hints,
    deadline math остаётся пн-пт пятница». Logic change deferred.
  - `gracePeriodHours` + `allowLateSubmissions` interaction: when
    `allowLateSubmissions=true`, leads can submit within grace; outside
    grace → blocked. When `allowLateSubmissions=false`, deadline is
    hard. UI shows «late» badge on submissions past deadline regardless.
  - `autoPublishAfterDeadline` fires `deadline + gracePeriodHours` later
    regardless of submission completeness. Missing sections render as
    «Не сдал» placeholder in the published report. Admin can disable
    and publish manually.

- Tests: contract (zod parse / reject for each new field) + integration
  (round-trip through `admin.updateSettings`) + UI smoke (each tab
  renders, Save calls mutation with merged payload).

## Steps

1. Schema additions in `prisma/schema.prisma` under `AppSettings`:

   ```prisma
   model AppSettings {
     id                            String   @id @default("singleton")
     // …existing fields…
     periodLengthDays              Int      @default(7)
     workingDays                   WorkingDays @default(MON_FRI)
     gracePeriodHours              Int      @default(24)
     defaultTimezone               String   @default("Europe/Moscow")
     defaultReminderAudience       ReminderAudience @default(LEAD_WITH_DRAFT)
     notificationFromEmail         String?
     allowLateSubmissions          Boolean  @default(true)
     autoPublishAfterDeadline      Boolean  @default(false)
     autoArchiveWeeksAfterPublish  Int      @default(0)
   }

   enum WorkingDays {
     MON_FRI
     MON_SAT
     MON_SUN
   }
   ```

2. Generate migration: `pnpm exec prisma migrate dev --name appsettings_expansion`.

3. Apply + regenerate Prisma client: `pnpm exec prisma generate`. Docker:
   `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"`.

4. Shared schema additions in `packages/shared/src/schemas/report.ts`
   (or wherever `appSettingsSchema` lives):
   - Extend the existing zod object with all 9 new fields + defaults
     matching SQL.
   - Add `workingDaysSchema = z.enum(['mon-fri', 'mon-sat', 'mon-sun'])`.
   - Add wire ↔ Prisma enum mapper for `WorkingDays` (mirror of
     `ReminderAudience` mapper from Phase 44-02).

5. Backend service:
   - `apps/api/src/modules/admin/admin.service.ts`: existing
     `getSettings` / `updateSettings` already round-trip the schema;
     no logic change, just the bigger payload.
   - `apps/api/src/modules/admin/admin.prisma-repository.ts`: map the
     new fields in `getSettings` / upsert in `updateSettings`. Apply
     the WorkingDays enum translator.

6. UI — Settings tabs (`apps/web/src/components/admin/settings-tab.tsx`):
   - After 48-A introduced the tab layout, this plan adds three child
     tabs.
   - **Periods tab** (existing fields + 6 new):
     - reuse the current departmentName-deprecation banner (will
       be removed in the AppSettings.departmentName drop release)
     - periodLengthDays: number input (1..31)
     - workingDays: radio group of 3 options
     - defaultDeadlineDays: existing numeric input
     - autoCreatePeriods: existing toggle
     - gracePeriodHours: number input (0..168) with help text
     - allowLateSubmissions: toggle
     - autoPublishAfterDeadline: toggle (disable when
       autoCreatePeriods=false — show muted hint «нужны
       автосозданные периоды»)
     - autoArchiveWeeksAfterPublish: number input (0=never)
   - **Reminders tab**:
     - defaultTimezone: select from TIMEZONE_OPTIONS
     - defaultReminderAudience: select of 2 enum values
   - **Notifications tab**:
     - notificationFromEmail: text input (email validation)
       with placeholder «reports@example.com»

7. UI — mapper additions in `apps/web/src/lib/mappers/admin.ts`:
   - Extend `MockSettings` (or rename to `AdminSettings` for clarity)
     with the 9 new fields.
   - Add a form input → tRPC payload mapper that defaults missing
     fields to current values (PATCH semantics, not PUT).

8. Tests:
   - `appsettings.contract.test.ts` (new): zod parse valid, reject
     out-of-range, reject bad email, reject unknown workingDays enum.
   - `admin.service.test.ts` (existing): extend to cover round-trip of
     the new fields.
   - `settings-tab.test.tsx` (existing): extend with one test per new
     tab — render → fill one field → Save → assert mutation called
     with merged payload.

9. Wire `defaultTimezone` and `defaultReminderAudience` into the
   ReminderPolicy form (44-04 surface) — when admin opens «New Policy»
   form, prefill timezone + audience from AppSettings defaults instead
   of hardcoded values. Single import change.

10. Manual UAT:
    - `pnpm db:reset:hard` to seed AppSettings with defaults.
    - Open `/admin?tab=settings&sub=periods`, change periodLengthDays=14,
      Save. Refresh — value persists.
    - Open Reminders tab, change defaultTimezone to Asia/Yekaterinburg, Save.
    - Open `/admin?tab=reminders` → New Policy. Assert timezone prefilled
      with Asia/Yekaterinburg.

## Verification Commands

```bash
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "\d \"AppSettings\"" | grep -c "periodLengthDays\|workingDays\|gracePeriodHours"
# expected: ≥3

curl -s "http://localhost:3002/trpc/admin.getSettings?..." -H "cookie: ..." | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d[0]['result']['data']['json'].keys()))"
# expected: includes new fields

pnpm --filter @customreport/api lint && pnpm --filter @customreport/api test
pnpm --filter @customreport/web lint && pnpm --filter @customreport/web test
```

## Commit

`feat(api,web): UFB-048 — AppSettings expansion (9 fields) + 3 Settings tabs (48-B)`

Body mentions:

- 9 new AppSettings fields + WorkingDays enum + migration
- 3 new Settings tabs (Periods, Reminders, Notifications)
- workingDays is metadata-only in v1 (logic deferred)
- gracePeriodHours + allowLateSubmissions semantics documented
- autoPublishAfterDeadline fires deadline+grace; missing → «Не сдал» placeholder
- defaultTimezone + defaultReminderAudience prefill into ReminderPolicy form
- Co-Authored-By: Claude Opus 4.7 (1M context)
