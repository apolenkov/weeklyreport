## ADDED Requirements

### Requirement: Priority-Ranked Slide Items Render in Ascending Rank Order

Priority-ranked Current and Next items on a slide SHALL render with ranked items
ahead of unranked items, ordered by ascending `priorityRank`, on both the lead and
the head deck.

The ordering is applied in `buildUnifiedSlideModel` (the single seam both decks
share), so `P1` always renders above `P3`. Unranked items (`priorityRank == null`)
MUST follow the ranked items in their original source order — a stable, nulls-last
sort. Risks and decisions carry no `priorityRank` and are unaffected. The dead,
unrendered `priorities[]` array and its three pre-filtered `?? 0` comparators MUST
be removed, since they render nothing and misrepresent the ordering.

#### Scenario: Higher-priority item renders above a lower-priority one

- **GIVEN** a lead's Current section with an item ranked `P3` authored before an item ranked `P1`
- **WHEN** the slide renders
- **THEN** the `P1` item appears above the `P3` item

#### Scenario: Unranked items follow ranked items in source order

- **GIVEN** a Current section mixing ranked and unranked items
- **WHEN** the slide renders
- **THEN** the ranked items lead in ascending rank
- **AND** the unranked items follow in their original authored order

#### Scenario: Same ordering applies on the head deck

- **GIVEN** the head deck rendering the same section via `buildUnifiedSlideModel`
- **WHEN** the slide renders
- **THEN** Current/Next items follow the identical priority-first ordering as the lead deck

### Requirement: Slide Priority Ordering Is Best-Effort and Render-Only

The ordering SHALL be best-effort over possibly duplicate or gapped ranks and SHALL
NOT renumber ranks, mutate any record, or reorder across pagination chunks.

`priorityRank` has no uniqueness constraint (`min(1).nullable`), so duplicate or
gapped ranks are possible; the sort surfaces them adjacently in ascending order
without renumbering. The change is render-only — it engages no write path,
period-dual-state, the role-coverage gate, or C1 review behavior. Ordering is bounded
to the items rendered within a page/section, not applied globally across the
product chunks `paginateSectionSlides` produces.

#### Scenario: Duplicate ranks render adjacently without renumbering

- **GIVEN** two Current items both carrying `priorityRank = 2` (API/seed-written)
- **WHEN** the slide renders
- **THEN** both render adjacently in the rank-2 position
- **AND** neither rank value is changed

#### Scenario: Ordering does not cross a pagination chunk

- **GIVEN** a section whose items paginate across more than one product chunk
- **WHEN** the slides render
- **THEN** ordering applies within each rendered page, not as a single global re-sort across pages
