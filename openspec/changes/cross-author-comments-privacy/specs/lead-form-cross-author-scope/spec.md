## MODIFIED Requirements

### Requirement: Cross-Author Lens Never Exceeds the Everyone Lens

The cross-author (co-lead) shared-product lens MUST NOT expose any field that
the curated Everyone lens (`CrossAuthorSectionRow`) omits — the server-side
lens produced by `filterSectionToSharedProducts` is bounded by that ceiling. In
particular, the shared read
MUST NOT carry the section author's `activities` (which include per-activity
status and free-text notes) or `reviews`: these MUST be emptied or dropped
rather than passed through the section spread. The shared read also
MUST NOT carry per-record `comments` (reviewer id, reviewer name, comment
text, created timestamp) on any retained `items`, `risks`, or `decisions`
row — `CrossAuthorSectionRow` declares no `comments` field on any of its
record types, so a retained record's `comments` MUST be stripped the same
way `activities`/`reviews` are, not passed through unfiltered. A co-lead who
shares one product MUST see no more than the Everyone lens discloses for
that section.

#### Scenario: Co-lead reads a section sharing one product

- **WHEN** a lead reads a co-lead's section through the shared-product lens
  while sharing a single product
- **THEN** the returned section carries empty `activities` and no `reviews`
- **AND** its items, risks, decisions, and projects remain scoped to the shared
  products only

#### Scenario: Shared lens matches the Everyone-lens ceiling

- **WHEN** the shared-product lens and the curated Everyone lens are compared
  for the same section
- **THEN** the shared-product lens exposes no field that the Everyone lens
  omits

#### Scenario: Retained records carry no reviewer comments

- **GIVEN** a co-lead shares one product with another author, and that
  author's items/risks/decisions on the shared product carry reviewer
  comments
- **WHEN** the co-lead reads that section through the shared-product lens
- **THEN** every retained item, risk, and decision has its `comments`
  stripped (empty or absent)
- **AND** reviewer identity and comment text are not disclosed to the co-lead
