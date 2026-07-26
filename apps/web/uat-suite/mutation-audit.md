# Mutation Consumer Audit

Mutations defined: 48
Queries defined: 44

- VERIFIED: 39
- PARTIAL: 6
- BLACK HOLE: 3 (0 unexpected)

## ✓ Allowlisted (intentional)

| Procedure                | Reason                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| admin.testTelegramSend   | Admin-only smoke-test producer for a transport that is deployed but not yet activated (seeds-only); pinned by a normative scenario in openspec/specs/queue-worker-architecture/spec.md.                                                                            |
| admin.saveReminderRule   | Deliberate soft-deprecation tombstone superseded by admin.savePolicy; admin.contract.test.ts asserts it throws METHOD_NOT_SUPPORTED and never reaches the service.                                                                                                 |
| admin.deleteReminderRule | Deliberate soft-deprecation tombstone paired with admin.saveReminderRule; admin.contract.test.ts asserts it throws METHOD_NOT_SUPPORTED and never reaches the service. Rules are derived from policies and die only with them, so having no consumer is the point. |

## ◐ Partial coverage (informational)

| Procedure            | Web refs | Same-NS queries |
| -------------------- | -------: | --------------: |
| review.comment       |        1 |               3 |
| review.deleteComment |        1 |               3 |
| review.verdict       |        4 |               3 |
| pdfExport.request    |        6 |               1 |
| period.publish       |        6 |               — |
| period.reopen        |        5 |               — |
