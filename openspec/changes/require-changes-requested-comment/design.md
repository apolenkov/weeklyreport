## Context

- `SectionReview` holds one row per `(reportSectionId, reviewerId)`; `writeVerdict` upserts it in a transaction that re-checks entitlement, takes the optimistic version lock, then calls `applyRevokeTransition` for a submitted section.
- Section reads already return `reviews[]` (`toReviewViews`) to the owning Lead, so a new field on that view reaches the Lead with no new procedure.
- `RecordComment` cannot be reused: it requires exactly one record anchor (CHECK constraint from the init migration).

## Decisions

1. **Store the comment on `SectionReview.comment` (nullable TEXT).** Alternatives rejected: a new table (a second write path, no need for history because the row is already one-per-reviewer and overwritten by the next verdict); a synthetic `RecordComment` (violates the anchor rule).
2. **Validation lives in the shared contract.** `reviewVerdictInputSchema` gains `comment: safeText({ max: REVIEW_COMMENT_MAX_LENGTH }).optional()` plus a `superRefine`: `changes_requested` needs a non-empty comment; `approved` must not carry one. The comment is trimmed by the schema before the non-empty check, so the service stores the trimmed value; the dialog counter counts trimmed characters, matching validation. The service trusts the parsed input; the router keeps `leadProcedure`-style canonical chain unchanged (no new procedure, role-coverage untouched).
3. **Write.** `upsertVerdict` sets `comment` on create and update; `approved` writes `null`, so a stale reason never outlives a later approval. A `changes_requested` on an already-draft section still records verdict and comment (no transition), matching current semantics.
4. **Read.** `toReviewViews` adds `comment: review.comment ?? undefined`; `sectionReviewViewSchema` gets `comment: z.string().min(1).optional()`. The published snapshot builder (`freezeSectionOwnership`) drops `comment` from each frozen review, so reviewer reasons never reach published output; a report-persistence test covers this.
5. **Lead UI.** `LeadReviewFeedback` accepts current `changes_requested` reviews and renders the reviewer name and comment above the record notes. It shows only reviews with `isCurrent` and a comment; a stale one after re-submit disappears with the rest of the "returned" state. Text is rendered as plain text.
6. **Head UI.** A shared modal `RequestChangesDialog` (textarea, counter against the max, `aria-invalid` and inline error for empty input, autofocus on open, Escape or Cancel closes, Submit disabled with "Requesting…" while pending, server error shown inline and the dialog kept open). Both `SectionVerdictControl` and the dashboard `RequestChangesButton` open it instead of mutating on the first click. Built on `DialogSurface` and `useDialogFocus` like the admin dialogs. UI strings are English.
7. **Old rows.** No backfill; `NULL` means "no reason recorded" and is not rendered.

## Migration

`prisma/migrations/<timestamp>_section_review_comment/migration.sql`: `ALTER TABLE "SectionReview" ADD COLUMN "comment" TEXT;` plus `comment String?` in `schema.prisma`. Additive, no data rewrite, no default. The migration was applied to the guarded local database `customreport_e2e` through the repository's guarded workflow; other environments receive it through the normal `migrate deploy` step.

## Deployment order and compatibility

1. Apply the additive migration first (old API and web keep working: the column is nullable and unused by them).
2. Deploy the API next. It accepts `comment` and rejects a comment-less `changes_requested`.
3. Deploy web last. An older web bundle sending `changes_requested` without a comment fails validation until it reloads, so web and API ship together. A newer web against an older API is not supported: the old API strips or rejects the unknown `comment` field and the reason would be lost.

## Risks

- Older web bundle against a newer API: the API rejects a comment-less `changes_requested`; see Deployment order above.
- Dashboard queue and review panel must both pass the comment, otherwise the request fails validation; tests cover both call sites.
