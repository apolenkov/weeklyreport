## ADDED Requirements

### Requirement: Draft rows follow the server visible-text rule

The lead form MUST decide whether a draft row's required text is present with the same visible-text predicate that the shared `safeText` validation applies. A row whose required text is empty, whitespace-only or composed only of characters that `safeText` treats as invisible MUST stay local-only and MUST NOT enter the autosave payload; the remaining rows of the draft MUST still be saved. Editors MUST refuse optional text that is non-blank but has no visible characters (activity title override, activity description, item next step, pause reason) with a visible-content error and keep the entered value for correction; they MUST NOT silently replace it with an empty or default value. The client MUST NOT trim, normalize or remove characters from text it saves beyond existing blank handling.

#### Scenario: An invisible-only row does not block its neighbours

- **WHEN** a lead's draft contains one item whose text is only a zero-width space and one item with visible text
- **THEN** the autosave payload contains only the visible item
- **AND** the payload passes the server draft-save validation

#### Scenario: An invisible-only required field keeps a risk or decision local

- **WHEN** a risk or decision has visible text in some required fields and only invisible characters in another
- **THEN** the row is excluded from the payload and counted as a local-only row

#### Scenario: Visible multilingual text is saved verbatim

- **WHEN** an item's text contains Cyrillic, CJK, a joiner-based emoji and a decomposed accented letter
- **THEN** the payload carries the exact text and passes server validation

#### Scenario: Editors refuse invisible-only optional text

- **WHEN** a lead enters only invisible characters as an activity title, activity description, item next step or pause reason
- **THEN** the editor shows a visible-content error, keeps the entered text and does not save it
- **AND** the server rejects the same value if it is submitted
