# lead-form-cross-author-scope Specification

## Purpose

Bound the cross-author (co-lead) shared-product lens on lead-form sections so it never discloses more than the curated Everyone lens.

## Requirements

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
way `activities`/`reviews` are, not passed through unfiltered. A retained
item's `pausedReason` (the author's free-text pause rationale, absent from
`CrossAuthorSectionRow.items`) MUST be stripped the same way. A co-lead who
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
- **AND** every retained item has its `pausedReason` stripped
- **AND** reviewer identity and comment text are not disclosed to the co-lead

### Requirement: Shared paused records remain readable without private reasons

Every cross-author section response MUST validate against an explicit shared
read contract after `filterSectionToSharedProducts` removes author-private
fields. A retained item with `workflowStatus: paused` MUST remain readable even
though its `pausedReason` is absent. The shared contract MUST reject
`pausedReason` and record comments rather than making them conditionally
available. Author-visible reads MUST retain the existing strict requirement for
a paused reason.

This rule applies to the selected Overview section and to both authoritative
predecessor sources: an immutable published snapshot and a submitted live
section fallback. The published shared contract MUST retain frozen record and
group identities, and the submitted shared contract MUST still require
`status: submitted`.

#### Scenario: Co-lead opens a current paused item

- **WHEN** an authorized co-lead opens another author's Overview and a retained
  shared-product item is paused with an author-private reason
- **THEN** the Overview returns the paused item through the shared contract
- **AND** the response omits its `pausedReason` and comments

#### Scenario: Published predecessor contains a paused item

- **WHEN** an authorized co-lead's immediate predecessor is a valid published
  snapshot containing a paused shared-product item
- **THEN** Previously planned can read the redacted item through the published
  shared contract
- **AND** frozen group, section, and record identities remain required

#### Scenario: Submitted predecessor contains a paused item

- **WHEN** no published snapshot exists and the authorized immediate predecessor
  has a submitted section containing a paused shared-product item
- **THEN** Previously planned can read the redacted item through the submitted
  shared contract
- **AND** a draft predecessor remains unavailable

#### Scenario: Author reads their own paused item

- **WHEN** an author reads their own paused item through the strict section
  contract
- **THEN** its `pausedReason` remains required and visible
