## Why

Owner decision 2026-09-29 (TASK-145.06): when the Head requests changes, a reason is mandatory and the Lead must see it. Today `review.verdict` with `changes_requested` returns the section to draft on one click, with no text. The Lead sees only the "Draft saved" state. Existing `RecordComment` rows are anchored to one item, risk or decision, so they cannot carry a section-level reason (a section may have no records, and one reason often covers the whole section).

## What Changes

- `review.verdict` accepts an optional `comment` (`safeText`, max `REVIEW_COMMENT_MAX_LENGTH`). It is required and non-empty when `verdict` is `changes_requested` and must be absent for `approved`.
- The comment is stored on the verdict row, so it is written in the same transaction as the verdict and the un-submit.
- The section read model exposes it as `reviews[].comment`; the Lead sees it in "Reviewer feedback" on the returned section.
- Request changes in the review panel and the dashboard queue opens a modal comment dialog (focus, validation error, pending state) instead of mutating on the first click.
- Lifecycle is unchanged: the existing revoke transition and period dual-state writers are reused as is.

## Impact

- Schema: one additive, forward-only migration adding a nullable `comment TEXT` column to `SectionReview`. It is applied to the guarded local database `customreport_e2e`; other environments apply it through the normal deploy step.
- Shared: `reviewVerdictInputSchema`, `sectionReviewViewSchema`. API: review-actions service, verdict write, review mapper. Web: `SectionVerdictControl`, `RequestChangesButton`, `LeadReviewFeedback`.
- Existing rows: verdicts created before the migration keep `comment = NULL`. The view shows no comment for them and the UI shows no placeholder; nothing is backfilled. Approved verdicts always store `NULL`.
