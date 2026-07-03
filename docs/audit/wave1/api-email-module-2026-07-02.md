# Per-file audit — apps/api/src/modules/email (2026-07-02)

Read-only audit, wave 1. No code changed.
1 file in scope, 2 findings kept (0 killed).
Owner fills the last column per finding (like/dislike).

## render-template.ts (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                              | Suggestion                                                                                                                                                                                                                                                                                                                                                                        | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15-22 | comments  | medium   | 8-line JSDoc header mixes ticket/phase archaeology ("NOTIF-01 (Phase 28-03), NOTIF-02 (Phase 29-05)") with a load-bearing WHY (multipart HTML+text improves corporate spam-filter scoring), all well over the 3-line comment budget. | Delete the ticket/phase references entirely (git history owns that). The multipart-for-spam-filters rationale is legitimate load-bearing context — relocate it to an openspec spec/ADR and leave a <=2-line pointer comment here, e.g. "// Returns html+text together: nodemailer needs both for multipart delivery (see docs/adr/... or openspec spec on email deliverability)." |              |
| 44-46 | comments  | low      | Inline comment "UFB-047 / Phase 49-01: subject prefixes the org `shortName`..." is change-log/ticket/phase archaeology attached to the deadline-email subject line.                                                                  | Delete the ticket/phase prefix; if the shortName-prefix rationale is non-obvious, keep only the WHY in <=1 line (e.g. "// prefix lets recipients' inbox rules filter on the org without parsing the long name").                                                                                                                                                                  |              |

Already good: file is 61 lines, one exported function (renderEmail, ~25 lines) with a clean discriminated-union input (EmailKind/EmailRenderInput) and exhaustive switch — easy to scan, single responsibility (render+subject only), no let/mutation, single caller (email-reminder.processor.ts) so no cross-module duplication.

## Rollup

By dimension: comments — 2 (1 medium, 1 low).
By severity: medium — 1, low — 1.

Top-3 highest-impact:

1. render-template.ts:15-22 — 8-line header comment violates the 3-line comment budget and buries a real WHY under ticket archaeology.
2. render-template.ts:44-46 — ticket-prefixed inline comment, low effort to strip.
3. (none further — only 2 findings in this module).

Pending openspec overlap: none. Both findings are comment-hygiene cleanup (`tighten-comment-policy` is the closest-named pending change but is about the comment-policy lint rule itself, not this module's specific ticket-archaeology instances) — handle as a direct style fix, not deferred to a backlog change.

## Killed by verification

None — both findings from the input data survived verification as-is; no findings were killed.
