# Tasks

- [x] 1. RED: contract test compares the CHECK value lists with `FEEDBACK_TYPES` and `FEEDBACK_STATUSES` and forbids row rewrites.
- [x] 2. GREEN: forward-only migration adds `SitepingFeedback_type_check` and `SitepingFeedback_status_check` on the mapped `SitepingFeedback` table.
- [x] 3. Apply the migration to the guarded disposable target `weeklyreport_e2e` and prove an unknown status is rejected. Proved 02.11 inside rolled-back transactions: both constraints add to the real table (0 rows) and a temp copy rejects `bogus` status and `nonsense` type while accepting a valid row.
- [ ] 4. Six repository gates on the final SHA; archive after acceptance.
