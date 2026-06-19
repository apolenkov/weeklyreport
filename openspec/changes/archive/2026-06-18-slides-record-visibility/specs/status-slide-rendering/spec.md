## ADDED Requirements

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

The Everyone visibility state MUST be offered only when the lead is viewing their OWN slide deck; when the slides target another author's deck (a foreign `authorId` in the URL), the deck MUST stay in Mine and MUST NOT merge the current user's cross-author rows onto the foreign author's base deck.

1. The slides URL may carry an `authorId` selecting whose base deck is shown.
   When that `authorId` is a different author than the current user, the
   visibility toggle MUST force/lock Mine (Everyone is not offered), so a foreign
   author's deck is never mixed with the current user's co-owner content.
2. The `crossAuthorContent` merge MUST run only for the current user's own deck —
   it is scoped to the current user's co-ownership, never re-targeted to a
   foreign displayed author.

#### Scenario: viewing another author's deck does not offer Everyone

- **WHEN** the slides are opened with an `authorId` pointing at a different lead
- **THEN** the deck renders that author's records in Mine and the Everyone toggle
  is not available (or is forced to Mine), so the viewer's own co-owner rows are
  never merged onto the foreign deck

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
