# lead-slide-row-density Specification

## Purpose

Defines how slide rows paginate under presentation density, reflect the selected author scope, disclose clamped text in full and keep metadata outside the prose flow.

## Requirements

### Requirement: Presentation density paginates every product record

The slide deck MUST offer an explicit Presentation density that pages by
product and caps records per view with deterministic continuation pages, while
the existing Document density keeps the auto-height all-content article.
Presentation density MUST preserve every record exactly once, product/record
order, author attribution, status, and Mine/Everyone scoping.
A project or activity subsection with no records is status context, not a record:
it MUST appear once, on the product's first page, and MUST NOT repeat on
continuation pages.

#### Scenario: One product exceeds the presentation cap

- **WHEN** a product contains more records than one presentation view allows
- **THEN** the model creates labeled continuation pages for that product
- **AND** flattening the pages yields every source record identity exactly once in source order

#### Scenario: The user switches density

- **WHEN** the viewer switches between Document and Presentation
- **THEN** the control exposes the active mode and is reversible
- **AND** no report data is re-fetched or discarded solely because density changed

#### Scenario: Document density remains available

- **WHEN** a slide is used for document reading or print-oriented review
- **THEN** the auto-height article continues to render all products and records without count-based truncation

#### Scenario: Recordless subsections are shown once

- **GIVEN** a product with a recordless activity subsection whose records span several pages
- **WHEN** Presentation density paginates the product
- **THEN** the recordless subsection appears on the first page only
- **AND** continuation pages carry no repeat of it

### Requirement: Slide author marks reflect the selected author scope

The lead slide grid MUST show the record-author mark on every content row. In
the single-author Mine scope, priority cards and the contributor legend MUST NOT
repeat the selected deck author's initials because the slide header already
establishes their scope-level ownership. In Everyone or another multi-author
scope, priority cards and the legend MUST carry the same stable identity used by
the row marks.

#### Scenario: a lead views their own Mine slide

- **WHEN** the lead slide deck is scoped to Mine and every row belongs to the selected deck owner
- **THEN** every row renders the record author's initials at top-right
- **AND** priority cards render without the owner's repeated initials badge
- **AND** priority rank badges use a neutral rank background instead of an owner identity color
- **AND** an owner-only contributor legend is omitted instead of leaving an empty separator
- **AND** record status and stage marks keep their existing order and meaning

#### Scenario: a lead switches to Everyone

- **WHEN** the lead slide deck is scoped to Everyone
- **THEN** every row shows that record author's stable mark, including the selected owner
- **AND** priority cards and the contributor legend show their author marks
- **AND** priority rank badges retain their author identity color

#### Scenario: a multi-author slide is reviewed outside the lead Mine scope

- **WHEN** a head or viewer reviews content whose rows can belong to different authors
- **THEN** author marks remain visible and consistent with the contributor legend

### Requirement: Clamped slide rows provide persistent full-text disclosure

Every non-empty slide row MUST expose a persistent, focusable disclosure that
reveals the complete status-and-text content inline without depending on
rendered overflow measurement. Risk disclosure MUST also show supplied impact
and mitigation; Decision disclosure MUST show supplied impact. Missing
supporting values MUST be omitted rather than fabricated.
The control MUST expose its expanded state and controlled region to assistive
technology, support keyboard activation, collapse on Escape while retaining
focus, and MUST NOT invoke an edit or mutate report data. The existing compact
two-line default, pointer-hover description and editable-row activation remain.

#### Scenario: A keyboard user reads and closes a long row

- **GIVEN** a Risk, Decision, Current or Next row whose body exceeds two lines
- **WHEN** the user focuses and activates its full-text disclosure
- **THEN** the complete row text remains visibly expanded until explicitly collapsed
- **AND** Escape collapses it with focus still on the disclosure
- **AND** no edit or draft command is emitted

#### Scenario: Supporting prose is available

- **GIVEN** a Risk has impact and mitigation, or a Decision has impact
- **WHEN** the user expands its disclosure
- **THEN** each supplied value is shown with its field label
- **AND** blank values do not create placeholder details

### Requirement: Slide row metadata stays outside the prose flow

Every non-empty Current work, Next focus, Risks and Decisions row MUST render
its record prose from the same stable left edge. A compact right metadata rail
MUST keep only the record-author badge at its top-right and MUST keep only
applicable stage marks at its bottom-right. Metadata MUST NOT enter the prose
flow or change the left alignment of wrapped text. Stage marks MAY wrap within
the rail when needed. A row MUST NOT render a separate Read/Close label or a
visible status glyph.

Every row MUST show its persisted record-author badge, including consecutive
rows by the same author and owner rows in Mine scope. Missing author resolution
MUST retain the existing unknown-author mark and MUST NOT be replaced with the
last editor or another inferred identity.

The existing two-line collapsed body, status colors and hover details MUST
remain. The prose itself MUST be a focusable disclosure: click, Enter and Space
toggle persistent full-text details, while Escape collapses and retains focus
on the prose. These reading commands MUST NOT invoke editing. An editable row
MUST retain double-click editing and MUST show an explicit keyboard-reachable
Edit action inside its expanded content.

#### Scenario: Metadata does not indent row prose

- **GIVEN** rows in Current work, Next focus, Risks and Decisions carry author or stage marks
- **WHEN** the slide renders the rows
- **THEN** every prose body begins at the same left edge
- **AND** author and stage marks remain visible in the right metadata rail

#### Scenario: Repeated record author stays visible

- **GIVEN** consecutive rows belong to the same record author
- **WHEN** the cell renders those rows
- **THEN** every row shows that author's badge at top-right
- **AND** no neighboring row is required to identify the author

#### Scenario: Reading and editing remain separate

- **GIVEN** an editable row with clamped prose
- **WHEN** the user activates its prose with click, Enter or Space
- **THEN** the disclosure changes only its reading state
- **AND** no edit or report-data command is emitted
- **AND** the expanded content exposes a separate Edit action
