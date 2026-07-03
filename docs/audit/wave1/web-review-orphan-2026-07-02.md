# Per-file audit — apps/web/src/components/review (2026-07-02)

Read-only audit, wave 2 web.
1 file reviewed.
1 finding kept, 0 killed.

## review-comment-list.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                             | Suggestion                                                                                                                                                                                                                                                                                          | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 6-16  | comments  | medium   | Component-header JSDoc is 11 lines, well over the 3-line WHY budget, and reads as spec/ticket archaeology: '(§6.2)', '(§8)', 'Born responsive (C5 R6)' are section/ticket references rather than in-code rationale. | Per tighten-comment-policy, relocate the durable rationale (why comments never re-render the anchor's own text, why renderAction exists) into the review-acknowledgement openspec spec, and trim the file comment to <=3 lines of load-bearing WHY (e.g. just the renderAction non-obvious reason). |              |

Already good: Clean single-purpose display component — renders nothing when empty, injects per-comment actions via a `renderAction` slot instead of owning mutation logic, so read-only callers (lead) and reviewer callers (head/viewer accordion in record-comments.tsx) share one implementation without duplicating markup; stable list key (`comment.id`, not index), correct aria-label on the list, and a small isolated `formatCommentDate` helper keep the file well under size/complexity thresholds.

## Rollup

**By dimension:** comments — 1 (medium)

**By severity:** medium — 1

**Top-3:** 1) review-comment-list.tsx JSDoc header exceeds the 3-line WHY budget and contains ticket/section archaeology.

**Overlaps with pending OpenSpec changes:** the finding overlaps `tighten-comment-policy` — handle the JSDoc trim there, not as a standalone style sweep.

## Killed by verification

None.
