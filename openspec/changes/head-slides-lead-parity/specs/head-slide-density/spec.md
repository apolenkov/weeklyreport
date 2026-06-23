# head-slide-density delta — head slides lead-deck parity

## ADDED Requirements

### Requirement: The head slides deck renders no standalone heading band

The head status deck MUST NOT render its own standalone title/subtitle
heading band; the report shell slides-mode header
(`apps/web/src/components/head/head-report-shell.tsx` — the `Status Report`
title plus the department context label) is the single title for the surface.
This mirrors the lead-slides layout (S1 umbrella): in slides mode the head
deck reads like the lead deck's slides chrome — no extra heading band above
the carousel, the report toolbar / header line hosts the deck's actions, and
the deck body carries only the carousel and the active fullscreen slide. The
deck MUST NOT render the `<h1>` "Group Status Slides", the subtitle "Group
deck ordered by review risk before publishing.", or any duplicate report
title inside the deck chrome.

#### Scenario: the head opens the slides deck

- **WHEN** the head views a report in `?mode=slides`
- **THEN** the only report title on the surface is the report shell header
  (`Status Report` + context label)
- **AND** the deck renders no standalone "Group Status Slides" heading band or
  duplicate subtitle above the carousel

#### Scenario: the head slides chrome mirrors the lead deck

- **WHEN** the head slides surface renders alongside the lead-slides layout as
  the reference
- **THEN** the head deck shows no head-only heading band the lead deck lacks
- **AND** the deck body holds only the carousel and the active fullscreen
  slide, with actions hosted on the report toolbar / header line

## REMOVED Requirements

### Requirement: Readiness folds into the active slide

**Reason:** S5 reverses the just-shipped carousel decision. The lead deck has
no readiness strip, and in the demo the head readiness signal is always 100%
(an empty signal the user found unclear). The strip is removed entirely from
the active head slide, not relocated, so the requirement no longer holds.

**Migration:** The `ReadinessStrip` and its `head-readiness-strip` testid are
deleted from `apps/web/src/components/slides/status-slide-deck.tsx`; the
per-slide readiness/score model is no longer rendered as deck chrome. The head
deck carries no side or in-slide completion panel — matching the lead deck.

### Requirement: The Agent review placeholder occupies a fixed slide-header slot

**Reason:** S6 relocates the inert `AgentReviewComingSoon` placeholder out of
the slide header into the report toolbar's context-control (period-controls)
row, like the head form mode and the lead deck. The slide-header slot is
removed, so this requirement no longer holds; the placeholder's toolbar
placement is governed by `head-toolbar-semantics` ("Deferred placeholders
render visually subordinate").

**Migration:** The `head-agent-review-slot` wrapper and its
`AgentReviewComingSoon` render are deleted from
`apps/web/src/components/slides/status-slide-deck.tsx`; the `mode === "form"`
gate in `head-report-shell.tsx` that mounted the placeholder only in form mode
extends to slides mode so the toolbar context row carries it in both modes.
