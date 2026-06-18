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
