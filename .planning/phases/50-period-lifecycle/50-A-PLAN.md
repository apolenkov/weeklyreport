# Phase 50-A — Defaults consumers wiring

**Status:** ready
**Depends on:** none (Phase 48-B persists the fields; this plan wires them)
**Requirement:** Settings → реальная логика — 3 quick wires

## Goal

Wire three AppSettings fields into their consumer code paths:
`defaultDeadlineDays`, `periodLengthDays`, `notificationFromEmail`.
After this plan: admin changes the value in UI, NEW periods / next
email sent reflect it.

## Acceptance Criteria

- `defaultDeadlineDays`: reading site verified in
  `weekly-report.service.ts` (or wherever
  `prisma.report.create` is called). The hardcoded `4` (or whatever
  current value) is replaced with `settings.defaultDeadlineDays`.
- `periodLengthDays`: same site computes `periodEnd = periodStart +
(settings.periodLengthDays - 1) days` (Mon-Sun = 7-1 = 6).
- `notificationFromEmail`: BullMQ email-reminder processor (and any
  other email-sending path) reads from
  `OrganizationService.getSettings().notificationFromEmail`. Falls
  back to `process.env.SMTP_DEFAULT_FROM` or
  `reports@customreport.local` only when settings value is null.
- Existing Periods are NOT retroactively recomputed. Test: change
  setting to 14, create new Period, assert periodEnd is +13 days
  from periodStart. Existing periods unchanged.
- Audit existing tests: any test that asserts a hardcoded deadline
  (`+ 4 days`) now reads the value from the AppSettings fixture.
- All existing tests stay green.

## Steps

1. Grep `defaultDeadlineDays` consumers:

   ```bash
   grep -rn "defaultDeadlineDays\|deadlineDays\|+ 4 days\|addDays(.*, 4)" \
     apps/api/src --include='*.ts' | grep -v test
   ```

   Expected: 1-3 sites. Each gets `settings.defaultDeadlineDays` instead.

2. Grep `periodLengthDays` / `periodEnd` consumers:

   ```bash
   grep -rn "periodEnd.*=\|periodLengthDays\|+ 6 days" apps/api/src \
     --include='*.ts' | grep -v test
   ```

3. Grep `notificationFromEmail` / hardcoded email:

   ```bash
   grep -rn "reports@customreport\|FROM_EMAIL\|fromEmail\|from:" \
     apps/api/src/modules/email \
     apps/api/src/infrastructure/bullmq \
     --include='*.ts'
   ```

4. Edit each consumer site to read from settings. Pattern:

   ```ts
   const settings = await this.adminRepo.getSettings();
   const periodEnd = DateTime.fromJSDate(periodStart)
     .setZone(settings.defaultTimezone)
     .plus({ days: settings.periodLengthDays - 1 })
     .toJSDate();
   const deadline = DateTime.fromJSDate(periodStart)
     .setZone(settings.defaultTimezone)
     .plus({ days: settings.defaultDeadlineDays })
     .set({ hour: 18, minute: 0, second: 0 }) // hardcoded until 51
     .toJSDate();
   ```

5. Test fixtures: bulk-update fixtures that create Periods inline so
   they include the AppSettings stub with sensible defaults. If a test
   used to assume a 4-day deadline, leave AppSettings.defaultDeadlineDays=4
   in the fixture (no semantic shift).

6. Email From wire:

   ```ts
   // in email-reminder.processor.ts
   const settings = await this.orgService.getSettings();
   await this.mailer.send({
     from:
       settings.notificationFromEmail ??
       process.env.SMTP_DEFAULT_FROM ??
       "reports@customreport.local",
     to,
     subject,
     html,
     text,
   });
   ```

7. Verify locally:

   ```bash
   rtk pnpm --filter @customreport/api lint
   rtk pnpm --filter @customreport/api test
   rtk pnpm --filter @customreport/web test  # mappers might need update
   ```

8. Docker post-conditions:

   ```bash
   docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"
   docker compose restart api
   ```

9. Manual smoke:
   - `/admin?tab=settings&sub=periods` → set `periodLengthDays=14`,
     Save.
   - Trigger a manual Period creation (or wait for 50-B's cron).
   - Open the new period → assert it spans 14 days.

## Verification Commands

```bash
grep -rn "addDays(.*, 4)\|+ 4 days" apps/api/src --include='*.ts' | \
  grep -v test
# expected: zero (or only in fixtures with AppSettings stub)
```

## Commit

`feat(api): UFB-048 — wire defaultDeadlineDays / periodLengthDays / notificationFromEmail consumers (50-A)`

Body:

- Period.create reads deadline + length from AppSettings
- Email-reminder reads From-address from AppSettings + env fallback
- Existing Periods unchanged; new Periods reflect current settings
- Co-Authored-By: Claude Opus 4.7 (1M context)
