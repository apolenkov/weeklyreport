# Design — demo feedback polish

## 1. Head draft visibility (the load-bearing decision)

The API already returns every lead section regardless of `status` — there is
NO submitted-only filter in the repository content query
(`weekly-report.prisma-repository.ts`; the only `status === "submitted"` use is
the `submissionCount` count). The empty surface is produced purely by the
frontend gate at `weekly-report-page.tsx:547`:
`submitted === 0 && periodStatus !== "published"` → empty state. So the fix is a
frontend gate change, not a query or schema change.

Locked decisions (grill 2026-06-22):

- Head sees all content (draft + submitted) always; "submitted" no longer gates
  visibility.
- Publish stays gated at ≥1 submitted (`canPublish = submitted > 0 && ...`).
- `Live · X/Y Submitted` badge stays.
- Empty state shows only when content is truly empty (no section has data), not
  merely when `submitted === 0`.
- Viewer unchanged: the service-layer published-only gate
  (`weekly-report.service.ts`, `role === "viewer" && periodStatus !== "published"`)
  stays.

Dependent signals to re-check when the gate relaxes: the publish button label
("Nothing to publish" vs "Publish & Lock"), the completion/readiness hint, and
the `showPublishHint` derivation — none should key off "is the screen empty"
anymore, only off the real publish precondition.

## 2. View-mode toggle

`ViewModeToggle` is rendered without a `mode` prop (`head-report-shell.tsx`), so
it defaults to `"edit"` and always highlights Edit. Pass
`mode={mode === "slides" ? "slides" : "edit"}`. Encode `scope` and
`includeArchive` in the URL (they are local `useState` today) so refresh and
shared `?mode=slides` links preserve the selection.

## 3. Pipeline tooltip color

`hiddenStagesEffectiveStatuses` already yields a `StageStatus[]` aligned 1:1
with the reveal lines. Thread it into `CollapsedStagesIndicator` and color each
row via `STATUS_CONFIG[status].text` (+ a leading status dot). Reuse the
existing tokens; introduce no new token. Keep the recent light popover surface.

## 4. Summary clip

The lead Summary scope (`scope-toggle` own = "Summary") renders `LeadUnifiedSlide`
via `ReportSlides` / `LeadSlideArticle` (`lead-slides-client.tsx`,
`scope === "own"`, line ~310). That surface is ALREADY governed by
`lead-slide-quadrants`, whose "a quadrant overflows its zone" requirement
mandates scroll-inside, not clipping. So the clipped row is a conformance bug
against an existing contract, not a missing requirement.

Decision (Codex Act-2, Q5): do NOT create a new `lead-summary-overflow`
capability — it would duplicate / conflict with `lead-slide-quadrants`. Fix the
overflow on the in-page (non-fullscreen) own-scope render so it honors the same
`overflow-y:auto` + `min-h-0` rule the fullscreen quadrants already use, and add
a regression test. No spec delta for this item.

## 5. Truly-empty empty state (head-report-visibility)

"Truly empty" in the head-report-visibility spec means no section has any item,
risk, or decision content — NOT `submitted === 0`. Reuse the existing
content-presence signal (e.g. `hasExpandableProducts` / a products-with-content
check) for the empty-state condition, never the submitted count.

## Tests

Each fix carries a test against the contract: a head/0-submitted view renders
draft content (and the empty state only when content is truly empty); the toggle
active segment matches the URL mode; the tooltip rows carry status color; the
Summary panel does not clip its last row.
