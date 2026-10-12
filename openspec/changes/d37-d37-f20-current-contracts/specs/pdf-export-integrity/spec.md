## MODIFIED Requirements

### Requirement: Printed reports preserve bounded layout content across page boundaries

The job-bound print template MUST keep every accepted bounded Product and
Activity value within the printable page. Unbroken attention text, entity names,
and contributor names MUST wrap without clipping, truncation, or hiding the
entity status and contributor metadata. Product and Activity sections whose
records exceed one page MUST paginate instead of being treated as indivisible.
Each Product Reports or Activity Reports heading MUST remain on the same page as
its first entity header.

#### Scenario: An unbroken attention value stays within the printable edge

- **GIVEN** a frozen Product with an accepted 500-character unbroken attention value
- **WHEN** the job template renders the Product report
- **THEN** the complete attention value remains visible within the printable page
- **AND** no part of the value is clipped at the right edge

#### Scenario: A long entity header preserves all metadata

- **GIVEN** a frozen Product or Activity with an accepted 200-character unbroken name and contributor name
- **WHEN** the job template renders its entity header
- **THEN** the complete entity name, status, and contributor name remain visible within the printable page

#### Scenario: An oversized report section paginates without an orphan heading

- **GIVEN** a Product or Activity report whose accepted records require more than one page
- **WHEN** the job template paginates that report
- **THEN** its records continue across page boundaries without being suppressed
- **AND** the Product Reports or Activity Reports heading remains with the first entity header instead of occupying an otherwise empty page

#### Scenario: A frozen report has no products

- **GIVEN** a frozen report whose product collection is empty
- **WHEN** the job-bound print template renders it
- **THEN** it emits neither a Product Reports heading nor a page break for that absent collection
- **AND** Activity Reports content and nonempty Product report output remain unchanged
