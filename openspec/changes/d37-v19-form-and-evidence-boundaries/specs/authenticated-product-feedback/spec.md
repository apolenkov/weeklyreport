## MODIFIED Requirements

### Requirement: The feedback inbox MUST support operational triage

The authenticated `/feedback` surface MUST present each visible record as an
operational work item with a labeled lifecycle status, actor/timestamp,
normalized page context, and an accessible path to detail. Detail MUST
separate the original annotation content from the append-only thread and
captured evidence. Only the exact author MAY edit that original content.
The workbench MUST NOT provide `Open context`, `Open live page`, or any other
navigation from a feedback item to the originating page. Recorded context,
captures, and thread MUST remain available inline in the detail view.

#### Scenario: An authorized reviewer opens a feedback item

- **WHEN** an authorized admin, head, lead, or other configured inbox role
  selects a visible record
- **THEN** the workbench shows its status, original author, original content,
  normalized context, evidence, and thread within the same feedback workflow
- **AND** no record outside the caller's server-authorized scope is disclosed

#### Scenario: A reviewer views recorded context

- **WHEN** an authorized reviewer opens an item's details
- **THEN** the app shows the recorded pathname, session/annotation identifiers,
  captures, and thread inline
- **AND** no control navigates to the originating page

#### Scenario: Recorded diagnostics repeat the same content

- **WHEN** a visible feedback record contains repeated console or network diagnostics
- **THEN** its inline detail preserves every supplied row, including repeated rows
- **AND** the renderer does not introduce another truncation limit beyond the shared capture boundary

#### Scenario: Captured viewport dimensions are large or unusable

- **WHEN** the stored viewport has valid positive integer dimensions such as 5120 by 2880
- **THEN** the screenshot uses those recorded dimensions without an arbitrary 4096 cap
- **WHEN** the recorded viewport is unparseable or has zero area
- **THEN** the screenshot uses the existing 1280 by 720 display fallback

### Requirement: Lifecycle actions MUST be explicit and capability-scoped

The workbench MUST label and expose the supported lifecycle states as `New`,
`Acknowledged`, `Resolved`, and `Dismissed`. It MUST expose only actions
allowed by the existing server-derived role, group, and ownership predicates.
The author MAY edit their own original annotation and reply to its thread when
domain rules permit; admins and heads MAY triage and reply to visible records
but MUST NOT rewrite a foreign original. Replies remain append-only evidence.

#### Scenario: An author edits their own original

- **WHEN** an authenticated author edits an editable annotation they own
- **THEN** the adapter updates only that author's original content and returns
  the current record

#### Scenario: A reviewer attempts to rewrite a foreign original

- **WHEN** an admin, head, or other reviewer submits an edit for an annotation
  they do not own
- **THEN** the adapter rejects the edit without changing the original content

#### Scenario: A reviewer replies

- **WHEN** an authorized reviewer submits a bounded reply
- **THEN** the adapter appends it with the server-derived actor and timestamp
- **AND** the original annotation remains unchanged

#### Scenario: The selected record changes while its edit form is open

- **WHEN** a visible feedback edit form receives a different record
- **THEN** its editable original text belongs to the newly selected record
- **AND** its disclosure reports whether that form is open

#### Scenario: A feedback action is submitted twice before rerender

- **WHEN** the same feedback edit, reply, dismissal or confirmed deletion action is activated twice before the pending state renders
- **THEN** that form sends one action while its first action is pending
- **AND** a failed action reports its error and permits a later retry
