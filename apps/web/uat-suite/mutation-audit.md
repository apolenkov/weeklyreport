# Mutation Consumer Audit

Mutations defined: 26
Queries defined: 25

- VERIFIED: 21
- PARTIAL: 4
- BLACK HOLE: 1 (0 unexpected)

## ✓ Allowlisted (intentional)

| Procedure         | Reason                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| carryOver.execute | Cron-triggered: copies forward unfinished items week-over-week. No UI consumer; user sees the result as carry-over rows in next week's items. |

## ◐ Partial coverage (informational)

| Procedure            | Web refs | Same-NS queries |
| -------------------- | -------: | --------------: |
| dev.wipeAndReseed    |        1 |               — |
| period.publish       |        2 |               — |
| period.reopen        |        2 |               — |
| ai.regenerateSummary |        2 |               3 |
