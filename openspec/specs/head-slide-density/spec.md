## Purpose

The head-role status deck now uses the same by-product `SlideArticle` contract
as lead and viewer presentation surfaces. This capability governs head-only deck
chrome around that article: recorded visual acceptance, top-carousel
navigation, fullscreen exit affordance, status-badge duplication, and removal of
the old standalone heading band. Article anatomy, colors, auto-height behavior,
and product-card layout live in `lead-slide-by-product-grid`.

## Requirements

### Requirement: Hosted density selection belongs to report context chrome

The Head and hosted Lead slide density selections MUST remain reversible between Document and Presentation while rendering inside their shared report context toolbars. Moving either control MUST NOT refetch, discard, reorder, or duplicate report records. A standalone Lead deck MAY retain its own density control.

#### Scenario: Head switches presentation density

- **WHEN** the Head changes Document to Presentation from the context toolbar
- **THEN** the active deck updates to the selected density without an extra toolbar row
- **AND** all source record identities remain represented exactly once according to the existing density contract

#### Scenario: Lead switches presentation density from report context

- **WHEN** a Lead changes Document to Presentation from the hosted report context toolbar
- **THEN** the active deck updates to the selected density without an extra deck density row
- **AND** fullscreen behavior remains available through the existing report toolbar control
- **AND** all source record identities remain represented exactly once according to the existing density contract

### Requirement: Head Presentation fills the report frame without poster-height waste

The Head Presentation slide frame MUST use the full available inline size of its desktop report frame rather than a narrower fixed maximum, and MUST use a tokenized compact minimum block size of `360px` that can grow with its content. The loading skeleton MUST preserve the same frame geometry so switching from loading to settled content does not create a layout jump. This correction MUST not change slide ordering, density semantics, or source-record identity.

#### Scenario: Head opens Presentation at desktop width

- **WHEN** the Head selects Presentation density
- **THEN** the active slide frame spans the available report content width
- **AND** the frame is at least the shared `360px` minimum while remaining auto-sized for taller content
- **AND** the settled frame preserves the loading frame's width and minimum-height contract

### Requirement: Head carousel exposes edge-aware navigation

The Head slide carousel MUST expose explicitly named Previous and Next buttons, disable Previous on the first slide and Next on the last slide, and keep the selected card visible when selection changes. The strip MUST use smooth scrolling and scroll snapping where motion is enabled, with reduced-motion behavior preserved. Selection visibility MUST adjust only the carousel viewport's horizontal scroll and MUST NOT request document or vertical scrolling. The controls MUST reuse the existing selected-index and slide-order contract without creating duplicate records or slides.

#### Scenario: Head pages through Presentation cards

- **WHEN** the Head activates Next or Previous
- **THEN** the selected index changes by one within the existing slide list
- **AND** the newly selected card is visible in the carousel viewport
- **AND** the corresponding edge control becomes disabled only at the first or last slide

### Requirement: The head-slide redesign ships only with recorded sign-off and visual acceptance

A change implementing `head-slide-density` MUST reference the recorded user
decisions that settled the design Open Questions, because those are deliberately
left as taste decisions, and MUST present same-viewport before/after screenshots
for user review before the change is archived - covering one-lead, many-leads,
empty-section, dense-decisions, and fullscreen states.

#### Scenario: a head-slide redesign implementation lands

- **WHEN** a change edits head slide density or layout
- **THEN** it cites the recorded user decisions for the open taste questions
- **AND** before/after screenshots across the listed states are produced for
  user acceptance before archiving

### Requirement: The head deck navigates via a top carousel

The head status deck MUST present its slides as a horizontal carousel of slide cards above the active slide, NOT as a left sidebar list. The carousel MUST group its slides by the current scope (Product vs Leads) and MUST keep the deck navigable across all slides (selecting a carousel card, plus the existing arrow-key navigation). Selecting a carousel card MUST make that slide the active fullscreen slide. When a single section's slides span multiple paginated pages, each carousel card MUST have a key that is unique per page (id plus page index, not the slide id alone), so pagination never produces a React key collision.

#### Scenario: the head opens the deck with multiple slides

- **WHEN** the head views a report with two or more slides in the current scope
- **THEN** a horizontal carousel of slide cards renders above the active slide
- **AND** there is no left sidebar list
- **AND** selecting a carousel card or pressing the arrow keys changes the
  active slide

#### Scenario: scope drives the carousel slide set

- **WHEN** the head switches the scope between Product and Leads
- **THEN** the carousel re-groups its slide cards to match the selected scope
- **AND** the head still sees every lead's data; the data scope is unchanged by
  the navigation model

#### Scenario: a paginated section produces collision-free carousel keys

- **WHEN** one section's slides span more than one page (the same underlying
  `item.id` repeated across pages with a different page index)
- **THEN** the carousel renders one card per page
- **AND** no two cards share a React key

### Requirement: The active head slide keeps a visible fullscreen exit path

The active head slide MUST reuse the shared fullscreen affordance (`DeckFullscreenOverlay` exit pill and Esc hint) while rendering the same auto-height by-product article governed by `lead-slide-by-product-grid`. The head MUST NOT be trapped in fullscreen without a visible exit path, and arrow-key navigation across slides MUST be preserved. Fullscreen state MUST persist across a slide change triggered by arrow-key navigation or a carousel-card selection — the browser MUST NOT force-exit fullscreen as a side effect of navigating to a different slide.

#### Scenario: the head opens a slide

- **WHEN** the head selects a slide from the carousel
- **THEN** the active slide renders the shared by-product article
- **AND** a visible exit-fullscreen control returns the head to the standard
  view
- **AND** arrow-key navigation across slides remains available

#### Scenario: fullscreen survives arrow-key navigation

- **WHEN** the head is in fullscreen on one slide and presses ArrowRight or
  ArrowLeft to navigate to another slide
- **THEN** fullscreen remains active on the newly active slide
- **AND** the browser does not force-exit fullscreen as a result of the
  navigation

### Requirement: Slide status renders exactly once per slide

The slide status (Blocked / Review / Ready) MUST render exactly once per slide.
The duplicate status badge that previously appeared both on the left sidebar
card and in the focused slide header MUST NOT recur.

#### Scenario: a slide has a status

- **WHEN** a slide resolves to a Blocked / Review / Ready status
- **THEN** that status badge renders exactly once on the surface
- **AND** it is not repeated in a separate list card and slide header

### Requirement: The head slides deck renders no standalone heading band

The head status deck MUST NOT render its own standalone title/subtitle heading
band; the report shell slides-mode header
(`apps/web/src/features/report-sections/ui/head-report-shell.tsx` - the
`Status Report` title plus the department context label) is the single title for
the surface. This mirrors the lead-slides layout: in slides mode the head deck
reads like the lead deck's slides chrome, with no extra heading band above the
carousel and with actions hosted on the report toolbar / header line. The deck
MUST NOT render the `<h1>` "Group Status Slides", the subtitle "Group deck
ordered by review risk before publishing.", or any duplicate report title inside
the deck chrome.

#### Scenario: the head opens the slides deck

- **WHEN** the head views a report in `?mode=slides`
- **THEN** the only report title on the surface is the report shell header
  (`Status Report` plus context label)
- **AND** the deck renders no standalone "Group Status Slides" heading band or
  duplicate subtitle above the carousel

#### Scenario: the head slides chrome mirrors the lead deck

- **WHEN** the head slides surface renders alongside the lead-slides layout as
  the reference
- **THEN** the head deck shows no head-only heading band the lead deck lacks
- **AND** the deck body holds only the carousel and the active fullscreen slide,
  with actions hosted on the report toolbar / header line
