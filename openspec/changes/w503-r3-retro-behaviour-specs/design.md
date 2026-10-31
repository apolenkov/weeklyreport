# Design

## Context

See `proposal.md`. The change documents behaviour that is already delivered; it
introduces no new decisions. Each requirement below was written from the
delivered code and its test, not from intent.

## Decisions

- Discard (`overview-item-submission.ts`): the save is deferred with
  `queueMicrotask`, so it runs after the autosave hook re-stamps the restore
  patch. Requirement: the saved payload carries the restored text.
- Sticky Retry (`lead-status-overview-content.tsx`, `lead-completion-actions.tsx`,
  `save-now-button.tsx`): the sticky cluster passes `saveDisabled` while an
  update is open, like the header cluster. After a failed Save update the
  persisted-save barrier ignores a generic `forceSave`, so a live Retry would do
  nothing; the editor's own Save update is the retry.
- Header badge (`lead-form-header-actions.tsx`): the order is Submitted, then
  Read-only, then Unsaved update, then the autosave badge.
- Slides skeleton (`head-slides-client.tsx`): live activity is cached without a
  period. A cache entry whose report ID differs from the active weekly report,
  while the activity read is fetching, counts as loading.
- `44eae8e8a` is covered by the existing `lead-form-data-loading` requirement
  and is intentionally not repeated.

## Risks

None beyond documentation drift; every scenario maps to a delivered test.
