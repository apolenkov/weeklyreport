# status-slide-rendering Specification

## Purpose

Define the density and layout invariants for the lead-role status slide
deck. Ensures that slide chrome keeps consistent tight density, that
visibility controls do not leak into persisted/exported data, and that the user
always has a discoverable fullscreen-exit path. The current slide article's
auto-height canvas and no-clipping behavior are governed by
`lead-slide-by-product-grid`.

Consumer surfaces: slide deck components under
`apps/web/src/features/slides/ui/`.

## Requirements

### Requirement: Slide Deck Must Provide an Exit-Fullscreen Affordance

When the user enters the slide deck in fullscreen mode, the deck MUST render a PERSISTENT, visible control that returns the user to the standard report view on EVERY deck (the lead deck and the head deck), so the control does not depend on toolbar/hero chrome that can scroll out of view in fullscreen. The user MUST never be trapped in fullscreen mode without a discoverable exit path. In addition, on entering fullscreen the deck MUST surface a discoverable hint that the `Esc` key exits (`Esc` always exits natively and cannot be suppressed), and the fullscreen toggle MUST expose its state to assistive technology via `aria-pressed` with a label that flips between "Enter fullscreen" and "Exit fullscreen". The toggle's state MUST be driven by the native `fullscreenchange` event so it stays correct when the user exits via `Esc`, and on exit focus MUST return to a concrete focusable control on the deck (never the floating exit pill, which unmounts when fullscreen ends) — on the lead deck the persistent toolbar toggle, on the head deck the deck article made programmatically focusable (`tabIndex={-1}`). The document-wide `f` fullscreen shortcut MUST have a single owner per deck so adding a second exit control does not double-toggle.

#### Scenario: a lead enters fullscreen and finds a visible exit

- **WHEN** a lead activates fullscreen on the lead slide deck
- **THEN** a persistent exit-fullscreen control is visible (independent of toolbar scroll position)
- **AND** clicking it returns the lead to the standard report view

#### Scenario: the deck shows an Esc hint on entering fullscreen

- **WHEN** any deck enters fullscreen
- **THEN** a discoverable hint that `Esc` exits is shown (it may be transient and auto-dismiss)
- **AND** pressing `Esc` returns the user to the standard report view

#### Scenario: exiting via Esc keeps the toggle correct and restores focus

- **WHEN** the user exits fullscreen by pressing `Esc` rather than the control
- **THEN** the fullscreen toggle reflects the non-fullscreen state (`aria-pressed="false"`, label "Enter fullscreen")
- **AND** focus is returned to the persistent toolbar toggle (not the floating exit pill, which unmounts when fullscreen ends)

### Requirement: The slide deck respects the Mine / Everyone visibility mode

The lead status slide deck MUST scope its records to the Record-visibility mode: Mine shows the lead's own records only, Everyone additionally merges co-owners' cross-author content on shared products into the deck's grids and KPI counters, while product health stays honest in both modes and Everyone never leaves the view layer.

1. In **Mine** the deck MUST show only the lead's own items/risks/decisions and
   the KPI counts MUST count own records only.
2. In **Everyone** the deck MUST merge the co-owners' cross-author content
   (items / risks / decisions) on shared products into the relevant slide grids,
   and the KPI counters MUST reflect own + foreign, so the deck reads the full
   shared picture.
3. Product health (the product badge / traffic light) MUST be identical in both
   modes — it already derives from the always-fetched, risk-derived
   `crossAuthors` status read (`applyForeignProductHealth`), independent of which
   records are shown.
4. Everyone in slides MUST be strictly view-only: the merged foreign rows MUST
   NOT appear in any draft, submission, published snapshot, or export/PDF
   payload. Switching the toggle MUST NOT change any persisted or exported data.
5. Everyone's full-content read MUST be gated and purged like the edit form:
   fetched only after the persisted visibility hydrates, and the cross-author
   content cache purged on identity/report change.
6. "Everyone" scope MUST remain the existing cross-author scope — co-owners of
   the lead's own products — not the entire group portfolio.

#### Scenario: Everyone fills the slide counters with own + foreign

- **WHEN** a lead opens their report in slides mode and switches Mine → Everyone
  on a product co-owned by another author who has current-week items and a risk
- **THEN** the deck's grids show the co-owners' rows on that shared product and
  the KPI counts increase to reflect own + foreign records

#### Scenario: Mine shows own records only

- **WHEN** the same lead switches Everyone → Mine
- **THEN** the deck shows only the lead's own records and the counters drop back
  to own-only

#### Scenario: health is unchanged across the toggle

- **WHEN** a co-owned product carries a foreign blocked stage and the lead
  toggles between Mine and Everyone in slides
- **THEN** the product badge reads blocked in both modes (health is
  toggle-independent)

#### Scenario: Everyone never leaks into export or snapshot

- **WHEN** the deck is in Everyone mode and any submit / publish-snapshot /
  export path is exercised
- **THEN** the payload contains the lead's own records only — the merged foreign
  rows are display-only and absent from persisted/exported data

### Requirement: Everyone is available only on the lead's own deck

The Everyone visibility state MUST be offered only when the lead is viewing their OWN slide deck; when the slides target another author's deck (a foreign `authorId` in the URL), the deck MUST stay in Mine, MUST NOT merge the current user's cross-author rows onto the foreign author's base deck, AND MUST NOT fire the `crossAuthorContent` read on that foreign deck.

1. The slides URL may carry an `authorId` selecting whose base deck is shown.
   When that `authorId` is a different author than the current user, the
   visibility toggle MUST force/lock Mine (Everyone is not offered), so a foreign
   author's deck is never mixed with the current user's co-owner content.
2. The `crossAuthorContent` merge MUST run only for the current user's own deck —
   it is scoped to the current user's co-ownership, never re-targeted to a
   foreign displayed author.
3. The `crossAuthorContent` read MUST be disabled on a foreign deck on EVERY host
   that runs it (the slide client AND the shared toolbar host), regardless of the
   current user's persisted visibility. A user whose persisted toggle is Everyone
   viewing a foreign `authorId` deck MUST NOT fire the read — the own-deck gate is
   evaluated independently of the persisted Mine/Everyone value.

#### Scenario: viewing another author's deck does not offer Everyone

- **WHEN** the slides are opened with an `authorId` pointing at a different lead
- **THEN** the deck renders that author's records in Mine and the Everyone toggle
  is not available (or is forced to Mine), so the viewer's own co-owner rows are
  never merged onto the foreign deck

#### Scenario: the foreign deck fires no cross-author content read

- **WHEN** a user whose persisted visibility is Everyone opens a foreign
  `authorId` slides deck
- **THEN** neither the slide client nor the shared toolbar host enables the
  `crossAuthorContent` query, so no cross-author content read is issued for the
  foreign deck

### Requirement: The Everyone merge introduces no new health-vs-count divergence

The Everyone merge MUST treat foreign records by the exact same rules as own records, so the relationship between product health (risk-derived) and the KPI counters is identical to Mine mode — Everyone adds rows but introduces no new badge-vs-count contradiction.

1. Product health stays risk-derived in both modes (existing invariant); the KPI
   counters count records. A foreign blocked item is counted exactly as an own
   blocked item is, and lifts (or does not lift) health by the same rule that
   applies to own blocked items — so Everyone creates no divergence that Mine
   does not already have.
2. Foreign records MUST NOT be double-counted: a record merged from
   cross-author content MUST appear once, scoped to its shared product.

#### Scenario: a foreign blocked item counts like an own blocked item

- **WHEN** in Everyone a shared product has a foreign blocked item and the same
  product in Mine has an own blocked item
- **THEN** each contributes to the blocked KPI by the same rule, and product
  health is derived from risks the same way in both modes — no new green-badge-
  with-blocked-count contradiction is introduced by the merge

#### Scenario: foreign rows are not double-counted

- **WHEN** Everyone merges a co-owner's items/risks/decisions on a shared product
- **THEN** each foreign row appears exactly once in the deck and the counters,
  scoped to that product

### Requirement: Paused and postponed rows keep the frame language

The lead slide grid MUST render `paused` and `postponed` items inside the row language governed by `lead-slide-by-product-grid`: both keep the dashed in-flight frame, and `postponed` uses muted text. Neither adds a visible status glyph. The row MUST retain the sr-only "Paused"/"Postponed" label and expose the specific status in its accessible and hover descriptions and expanded details, so identifying the status does not depend on color alone.

#### Scenario: paused item on the slide

- **WHEN** a current item with status `paused` renders on the lead slide
- **THEN** the collapsed row shows the dashed frame without a visible status glyph or status words
- **AND** its sr-only label and accessible/hover descriptions identify "Paused"

#### Scenario: postponed item is distinct from planned

- **WHEN** a next item with status `postponed` renders beside a `planned` one
- **THEN** the postponed row retains its muted treatment without a visible status glyph
- **AND** accessible/hover descriptions and expanded details identify the distinct statuses

### Requirement: The lead slide deck clamps an out-of-range selected index

The lead slide deck MUST keep `selectedIndex` within the bounds of the
current `slides` array: whenever the slide list shrinks (an active-period
rollover or a background refetch dropping own-section pages) below the
index the user was viewing, the deck MUST reset `selectedIndex` back to `0`
instead of rendering the "No slides available" empty state while valid
slides still exist at lower indexes.

#### Scenario: slide list shrinks below the current page

- **WHEN** a lead is viewing a non-zero slide index and a data refresh
  (period rollover or background refetch) shrinks `slides` so that index no
  longer exists
- **THEN** the deck resets `selectedIndex` to `0` and renders the first valid
  slide instead of the empty state

#### Scenario: slide list stays within range

- **WHEN** `slides` refreshes but still contains the currently selected index
- **THEN** `selectedIndex` is left unchanged and the same slide keeps
  rendering

### Requirement: Fullscreen keyboard shortcut preserves browser and editor input

The shared fullscreen shortcut MUST toggle a deck only for an unmodified `f` or
`F` keydown outside form controls and contenteditable content. It MUST ignore
Ctrl, Meta, Alt or Shift modifiers, composing input, repeated keydowns and events
already handled with preventDefault. Ignored events MUST retain their browser or
editor behavior. Fullscreen buttons and exit focus MUST remain unchanged.

#### Scenario: Browser Find does not toggle the deck

- **WHEN** a user presses Ctrl+F or Meta+F while a deck is available
- **THEN** the fullscreen listener neither toggles fullscreen nor prevents Find

#### Scenario: Plain F remains available

- **WHEN** a user presses an unmodified non-repeated `f` or `F` outside an editor
- **THEN** the shared listener toggles fullscreen exactly once

#### Scenario: Other handled or non-shortcut input is ignored

- **WHEN** F is modified by Alt or Shift, composing, repeated, already prevented,
  or entered in a form control or contenteditable element
- **THEN** the fullscreen listener does not toggle the deck or consume the event

### Requirement: Fallback slides retain report period identity

The head deck MAY use activity rows when its requested report is open or
reopened and contains no lead sections. It MUST request that fallback only
when needed and enabled by its host. It MUST render fallback rows only when
the activity response report ID matches the weekly report ID. Published and
archived reports without sections MUST remain empty.

#### Scenario: Another period is current

- **GIVEN** the selected report contains no sections
- **WHEN** activity resolves for a different report ID
- **THEN** none of those activity rows appears in the selected deck

#### Scenario: Activity belongs to the empty editable report

- **WHEN** an empty open or reopened report receives activity for its own ID
- **THEN** the deck may show those activity rows

#### Scenario: Activity fallback is unnecessary

- **WHEN** the report is populated, published, archived, absent or still loading,
  or its host disables activity fallback
- **THEN** the deck does not enable the activity read
