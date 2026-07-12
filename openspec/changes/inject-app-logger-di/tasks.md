## 1. Admin module

- [ ] 1.1 In `apps/api/src/modules/admin/admin.module.ts`, replace the
      `AdminService` provider with a `useFactory` that injects
      `AdminPrismaRepository` and `APP_LOGGER` and passes both to
      `new AdminService(repo, logger)`.
- [ ] 1.2 Import `APP_LOGGER` from `../../lib/audit-logger.js` (same import
      `period.module.ts` uses).
- [ ] 1.3 Confirm `ConfigModule` is already in `admin.module.ts`'s `imports`
      array (it is); no import change needed there.

## 2. PDF-export module

- [ ] 2.1 In `apps/api/src/modules/pdf-export/pdf-export.module.ts`, add
      `ConfigModule` to `imports`.
- [ ] 2.2 Import `APP_LOGGER` from `../../lib/audit-logger.js`.
- [ ] 2.3 Add `APP_LOGGER` to the `PdfExportService` factory's `inject`
      array and pass it as the second constructor argument, replacing the
      hard-coded `undefined`: `new PdfExportService(repo, logger, queue, cls)`.

## 3. Reminders module

- [ ] 3.1 In `apps/api/src/modules/reminders/reminders.module.ts`, add
      `ConfigModule` to `imports`.
- [ ] 3.2 Import `APP_LOGGER` from `../../lib/audit-logger.js`.
- [ ] 3.3 Add `APP_LOGGER` to the `RemindersService` factory's `inject`
      array and pass it as the second constructor argument, replacing the
      hard-coded `undefined`: `new RemindersService(repo, logger, queue, cls)`.

## 4. Verification

- [ ] 4.1 Regenerate the Prisma client before typechecking: `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 Typecheck the api workspace: `pnpm --filter @customreport/api typecheck`
- [ ] 4.3 Lint the three changed modules: `pnpm --filter @customreport/api exec eslint src/modules/admin/admin.module.ts src/modules/pdf-export/pdf-export.module.ts src/modules/reminders/reminders.module.ts`
- [ ] 4.4 Run the api unit suite: `pnpm --filter @customreport/api test`
- [ ] 4.5 Live-verify: boot the api from source, exercise an admin settings
      update, a PDF export request, and a reminder dedup path, and confirm
      `info`-level log lines appear in stdout/Bugsink instead of being
      silently dropped by the null logger.
