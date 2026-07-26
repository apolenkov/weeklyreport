# Mutation Consumer Audit

Mutations defined: 50
Queries defined: 44

- VERIFIED: 33
- PARTIAL: 6
- BLACK HOLE: 11 (11 unexpected)

## ⚠ Unexpected black holes (CI fail)

Mutations with no consumer + not in allowlist. Wire a consumer or add to mutation-audit.allowlist.json with justification.

| Procedure                  | Same-NS queries | Web refs |
| -------------------------- | --------------- | -------: |
| admin.testTelegramSend     | 15              |        0 |
| admin.savePeriod           | 15              |        0 |
| admin.saveReminderRule     | 15              |        0 |
| admin.deleteReminderRule   | 15              |        0 |
| archive.unarchiveReport    | 2               |        0 |
| reminders.execute          | 1               |        0 |
| projectActivity.create     | 1               |        0 |
| projectActivity.update     | 1               |        0 |
| projectActivity.archive    | 1               |        0 |
| projectActivity.attachLead | 1               |        0 |
| projectActivity.detachLead | 1               |        0 |

## ✓ Allowlisted (intentional)

| Procedure         | Reason                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| carryOver.execute | Cron-triggered: copies forward unfinished items week-over-week. No UI consumer; user sees the result as carry-over rows in next week's items. |

## ◐ Partial coverage (informational)

| Procedure            | Web refs | Same-NS queries |
| -------------------- | -------: | --------------: |
| review.comment       |        1 |               3 |
| review.deleteComment |        1 |               3 |
| review.verdict       |        4 |               3 |
| pdfExport.request    |        6 |               1 |
| period.publish       |        6 |               — |
| period.reopen        |        5 |               — |
