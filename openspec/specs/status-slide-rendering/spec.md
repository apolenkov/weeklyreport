# status-slide-rendering Specification

## Purpose

Define the density and layout invariants for the lead-role status slide
deck. Ensures that slide cards render at consistent tight density, that
decisions remain reachable via scroll when overflow occurs, and that the
user always has a discoverable fullscreen-exit path.

Consumer surfaces: `StatusSlideDeck`, `SummarySlide`, `DecisionSlide`
components in `apps/web/src/components/`.

## Requirements

### Requirement: Slide Card Density Tokens Are Consistent Across the Deck

The status slide deck MUST apply the same values for its three density
tokens — outer card padding, section-header line-height, and inter-slide
gap — across every slide card. Changing a density token MUST affect all
slide cards in the deck simultaneously; no individual card MUST silently
override the shared value.

#### Scenario: Designer tightens slide padding

- **WHEN** a contributor changes the slide outer-padding token from `p-3` to `p-2`
- **THEN** every slide card in the deck (status, summary, decision) reflects the new padding
- **AND** no per-component override silently retains the old value

### Requirement: Slide Cards Use Tight Density Defaults

The default density for the lead-role status slide deck MUST be:

- outer card padding ≤ `12px` (Tailwind `p-3` or tighter),
- section-header `line-height` ≤ `1.4`,
- inter-slide gap ≤ `12px` (Tailwind `gap-3` or tighter).

These defaults MUST hold for `StatusSlideDeck`, `SummarySlide`, and
`DecisionSlide`. The head-role report slides view is out of scope for
this requirement.

#### Scenario: Lead opens the status slide deck

- **WHEN** a lead opens their report in slide-deck mode
- **THEN** outer card padding renders at ≤ 12px
- **AND** section headers render with `line-height` ≤ 1.4
- **AND** gap between consecutive slides renders at ≤ 12px

#### Scenario: Head opens the same report in slide mode

- **WHEN** a head opens the report in slide-deck mode
- **THEN** the head-role density rules apply (unchanged by this requirement)
- **AND** lead-role density tokens are not used in the head view

### Requirement: Decisions Slide Must Constrain Vertical Overflow

The decisions section on the status slide deck MUST render inside a
scrollable container with a finite `max-height` so that arbitrarily many
decisions remain reachable. Content that exceeds the visible height MUST
become reachable via vertical scroll within the slide card; it MUST NOT
push subsequent slides off-screen or cause the deck container to grow
without bound.

#### Scenario: Slide renders fewer decisions than the container height

- **WHEN** a report period has 1-3 decisions
- **THEN** the decisions slide renders all of them without a scrollbar
- **AND** the slide card height matches its natural content

#### Scenario: Slide renders more decisions than the container height

- **WHEN** a report period has 10+ decisions that exceed the slide's `max-height`
- **THEN** the decisions section becomes vertically scrollable inside the slide
- **AND** all decisions remain reachable via scroll without leaving slide mode

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

### Requirement: Product Separators Must Share a Common Baseline

Product-group separators on the status slide view MUST render at a
consistent vertical baseline relative to each product group. The
baseline rule (top-aligned with the product title OR center-aligned
per group) MUST be applied uniformly across all groups so the eye
flow remains predictable.

#### Scenario: Slide renders three product groups

- **WHEN** the status slide view renders 3+ product groups in a single deck
- **THEN** each product separator appears at the same vertical offset relative to its product title
- **AND** no group's separator sits at a different baseline than the others

#### Scenario: One product group has more items than the others

- **WHEN** product A has 2 items and product B has 7 items on the same slide
- **THEN** the separator after product A still aligns with the separator after product B (according to the chosen baseline rule — e.g., both top-aligned with the next product title)
- **AND** the asymmetric item count does not push the separator into a different vertical position

### Requirement: The slide deck respects the Mine / Everyone visibility mode

The lead status slide deck MUST scope its records to the Record-visibility mode: Mine shows the lead's own records only, Everyone additionally merges co-owners' cross-author content on shared products into the deck's grids and KPI counters, while product health stays honest in both modes and Everyone never leaves the view layer.

1. In **Mine** the deck MUST show only the lead's own items/risks/decisions and
   the KPI counts MUST count own records only (today's behavior).
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

### Requirement: The lead slide hero sits at the same inset in every scope

The lead slide hero (status strip + scope toggle) MUST render at the same horizontal and vertical inset within the `.slide-frame` regardless of the active scope (Summary/own vs Product), so toggling scope never shifts the status strip or the scope toggle.

1. The hero's left inset and top offset relative to the `.slide-frame` MUST be
   identical (±1px) across scopes; the two scopes MUST NOT wrap the hero in
   wrappers with different padding.
2. Only the hero box position is unified — the per-scope CONTENT below the hero
   is unchanged (own scope shows the summary quadrants; product scope shows the
   product grid).

#### Scenario: Toggling Summary ↔ Product does not move the hero

- **WHEN** a lead in slides mode toggles the scope between Summary and Product
- **THEN** the status strip and scope toggle stay at the same on-screen position
- **AND** only the content area below the hero changes between the two scopes
