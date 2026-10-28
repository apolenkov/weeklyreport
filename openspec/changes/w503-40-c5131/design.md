# Design: Accessible Draft-Hidden Signal in Report Review

## Context

In `apps/web/src/features/review/ui/submission-filter.tsx`, `DraftHiddenSignal` renders an anti-empty banner when the report filter is set to "Submitted" but draft sections exist.
Currently, this banner renders as a plain `<div>` without ARIA live-region attributes (`role="status"`, `aria-live="polite"`). In addition, the inner button text is simply "Show all", which lacks context for screen readers when navigated out of flow.

## Goals / Non-Goals

**Goals:**

- Provide screen reader notifications when the banner appears/disappears without aggressive interruptions (`role="status"`, `aria-live="polite"`).
- Keep announcements polite and prevent duplicate announcements.
- Provide descriptive accessible naming to the "Show all" button (`aria-label="Show all sections including drafts"`).
- Verify behavior through unit tests in `submission-filter.test.tsx`.

**Non-Goals:**

- Radiogroup restructuring for the toggle buttons (C5130).
- Altering the visibility logic in parent components (`weekly-report-content.tsx`).

## Decisions

### Decision 1: Use `role="status"` and `aria-live="polite"` on `DraftHiddenSignal` container

`role="status"` has an implicit `aria-live="polite"` in standard ATs, but explicitly specifying both `role="status"` and `aria-live="polite"` guarantees cross-browser / cross-screenreader announcement consistency without being assertive (`role="alert"` would interrupt user flow).

### Decision 2: Disambiguate "Show all" action via `aria-label`

Adding `aria-label="Show all sections including drafts"` gives assistive tech users clear context when reading by button controls, while preserving the clean visual copy ("Show all") for sighted users.

## Risks / Trade-offs

- [Risk]: Screen reader announces the live region multiple times if re-rendered.
  → Mitigation: `role="status"` with polite live region only triggers announcement upon content changes or mounting. No artificial timer or live region duplication is added.
