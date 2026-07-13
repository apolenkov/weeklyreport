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
rather than passed through the section spread. A co-lead who shares one product
MUST see no more than the Everyone lens discloses for that section.

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
