# Tasks

- [x] 1. RED: contract test compares the CHECK value lists with `FEEDBACK_TYPES` and `FEEDBACK_STATUSES` and forbids row rewrites.
- [x] 2. GREEN: forward-only migration adds `SitepingFeedback_type_check` and `SitepingFeedback_status_check` on the mapped `SitepingFeedback` table.
- [x] 3. Apply the migration to the guarded disposable target `weeklyreport_e2e` and prove an unknown status is rejected. Proved 02.11 inside rolled-back transactions: both constraints add to the real table (0 rows) and a temp copy rejects `bogus` status and `nonsense` type while accepting a valid row.
- [x] 4. Acceptance review (Astra, 02.11): the contract test now reads the newest
      definition of each constraint across the migration chain, so a later
      forward-only enum migration keeps it honest (mutation: a later probe
      migration with another list fails it). Rows outside the lists would abort
      the migration in one transaction without data loss; the API writes only
      Zod-validated values, so a deployment check of existing values is the
      remaining operator step. Six repository gates on the final SHA.
