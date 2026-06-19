## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Everyone deck surfaces a Coming-Soon affordance for per-row author attribution

The lead slide deck MUST render a visible Coming-Soon affordance acknowledging that per-author row attribution is deferred, shown only on the lead's own deck in Everyone, built on the shared `ComingSoonBadge` primitive so it carries the single canonical deferred-feature style.

1. In Everyone, co-owners' rows merge into the slide grids as plain bullets with
   no per-row "who owns this" marker (the grids are flat text arrays); the
   affordance MUST tell the presenter this attribution is roadmapped rather than
   leave a silent gap.
2. The affordance MUST be an inert control (no action), using the shared
   `ComingSoonBadge` primitive and the canonical `title="Coming Soon"` +
   descriptive `aria-label` pattern — it MUST NOT hand-roll a bespoke pill.
3. The affordance MUST appear ONLY on the lead's own deck in Everyone; in Mine
   (no foreign rows) and on a foreign deck it MUST NOT render.
4. The affordance attributes the merged bullet ROWS, so it MUST render in the
   bullet-row (own-scope) deck view; it MUST NOT render in the product-grid
   (product-scope) view, where foreign content folds into health/counters rather
   than into attributable rows.
5. The affordance MUST be hidden while the deck is in fullscreen presentation: it
   is a working-view hint for the lead, not part of the projected deck the lead
   shows to an audience. It renders only in the normal (non-fullscreen) view.

#### Scenario: Everyone on the own deck shows the attribution Coming-Soon control

- **WHEN** a lead switches their own slide deck Mine → Everyone in the bullet-row
  (own-scope) view
- **THEN** an inert Coming-Soon affordance for per-author row tags is visible in
  the deck's hero controls, carrying the canonical deferred-feature style

#### Scenario: Mine, foreign decks, product-scope, and fullscreen hide the affordance

- **WHEN** the deck is in Mine, OR the slides target a foreign `authorId`, OR the
  deck is in the product-grid (product-scope) view, OR the deck is in fullscreen
  presentation
- **THEN** the per-author-tags Coming-Soon affordance does not render
