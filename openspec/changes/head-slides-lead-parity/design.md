# Design — head slides lead-deck parity

## Why this supersedes part of the just-archived carousel change

`head-slides-carousel-fullscreen` (archived 2026-06-23, now live in
`head-slide-density`) brought the head deck to a carousel + fullscreen model.
The 2026-06-23 live demo accepted the carousel (S4) but found the deck still
diverges from the lead deck. Two requirements that change added are reversed
here:

- "Readiness folds into the active slide" — REMOVED (S5). The strip is deleted,
  not relocated: the lead deck has none, and the demo signal is always 100%.
- "The Agent review placeholder occupies a fixed slide-header slot" — REMOVED
  (S6). The placeholder relocates to the toolbar, already governed by
  `head-toolbar-semantics`.

These were taste decisions one demo ago; the reversal is small and local
(removing deck chrome and re-homing the placeholder the toolbar already knows
how to host), so no new ADR is warranted — the supersede is recorded in the
proposal and these spec deltas.

## S3 — "Open focused report" placement and the state-lift it requires

The one real design choice. Today "Open focused report" is rendered **inside
the deck** (`status-slide-deck.tsx` header band) because its href is
**per-slide**: it depends on the active slide's `ownerId`
(`head-slides-client.tsx` builds
`/head/report/<reportId>?authorId=<selectedSlide.ownerId>`). The top toolbar /
slides-mode header line is rendered by `head-report-shell.tsx`, **outside**
`HeadSlidesClient`, and the active-slide `selectedIndex` lives inside the
client.

Options for moving the action to the header line (S3):

1. **Lift the selection state up.** Hoist `selectedIndex` (or the resolved
   active `authorId`) out of `HeadSlidesClient` into `head-report-shell.tsx`
   so the header-line action can target the active slide's lead. Preserves the
   per-slide-owner targeting the current link has.
2. **Generic open-report link.** Make the header action a generic "Open
   focused report" that opens the report at the current period without an
   `authorId` (drops per-slide owner targeting).

**Decision: Option 1 (lift state up).** The spec asserts the action targets
the active slide's lead and renders only when a target resolves, so the
implementation must surface the active slide's owner to the shell. Option 2
would silently drop a working capability (drill into the specific lead whose
slide is on screen), which the user did not ask to remove — they asked only to
move the control to the toolbar "like the leads". The implementer lifts the
selected-slide owner from the client to the shell header line; the action
does not render when no active slide / active period resolves.

## Implementation notes (pin during apply)

- The head deck is `HeadSlidesClient` → `ReportSlides variant="head"` →
  `StatusSlideDeck` (`apps/web/src/components/slides/status-slide-deck.tsx`,
  head branch `HeadSlideArticle`).
- **S2 (no heading band):** the deck `<header>` band holds four things, all
  removed for the head surface, not just the title:
  - `<h1>{title}` + subtitle — the report title duplicate the user flagged.
  - `groupLabel` pill (`reportingGroupName ?? "Group scope"`) — dropped:
    redundant with the shell header's `departmentLabel`
    (`head-report-shell.tsx:193-197`).
  - `reportLabel` pill (week label + range) — dropped: NOT load-bearing. The
    period identity is carried by the `PeriodNavigator` combobox in the slides
    toolbar context row (`head-report-shell.tsx` `contextControls`), which
    shows `periodLabel(selectedPeriod)`, so removing the pill drops no week
    identifier.
  - the "Open focused report" link — relocated (S3).
    `head-report-shell.tsx` already renders the `Status Report` header + context
    label in slides mode — that is the single title.
- **S3 (Open focused report → toolbar):** render it on the slides-mode header
  line in `head-report-shell.tsx` beside the Export-PDF `DocumentActionGroup`;
  drop the deck's in-body link. Requires lifting the active-slide owner (above).
- **S5 (remove ReadinessStrip):** delete `ReadinessStrip`, its
  `head-readiness-strip` testid, and the `<ReadinessStrip … />` render from
  `status-slide-deck.tsx`. The per-slide readiness/score model is no longer
  rendered as deck chrome.
- **S6 (Agent review → toolbar):** delete the `head-agent-review-slot` wrapper
  - `AgentReviewComingSoon` render from `status-slide-deck.tsx`; extend the
    `mode === "form"` gate in `head-report-shell.tsx` (`contextControls`) to
    slides mode so the toolbar context row carries exactly one placeholder. The
    gate exists today only to avoid double-mounting against the in-slide slot —
    with the slot gone, slides mode mounts it like form mode.
- **S1 (umbrella):** the net result reads like the lead-slides layout — verify
  the head slides chrome against the lead deck as the reference.

## Verification

`head-slide-density` requires same-viewport before/after screenshots for any
head-slide layout change. Produce them on the local stack (`:3000`) — at least
many-leads (lead + product scope) and a per-active-slide view — showing: no
deck heading band, "Open focused report" on the header line, Agent review in
the toolbar context row, and no readiness strip. Capture for user acceptance
before archiving.

## Risks

- Lifting the active-slide owner out of `HeadSlidesClient` must not change the
  carousel selection behavior or arrow-key navigation (S4 untouched).
- Removing the slide-header Agent-review slot must not leave slides mode with
  zero placeholders or double-mount one — the toolbar context row must carry
  exactly one in slides mode.
- The deck still renders for non-head consumers (the `showChrome` / lead path);
  the heading-band removal must scope to the head surface and not regress the
  lead deck chrome.
- `head-slide-density`'s Purpose prose (lines 16-19) still names "the per-lead
  readiness aside" and "the `AgentReviewComingSoon` control" as head-only
  surfaces that stay distinct. OpenSpec deltas don't rewrite Purpose, so after
  archive that prose will contradict these removals (S5/S6). Touch the Purpose
  in a follow-up when archiving — non-blocking for this change.
