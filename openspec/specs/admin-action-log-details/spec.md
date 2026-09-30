# admin-action-log-details Specification

## Purpose

Define the admin-only Action Log as a privacy-bounded audit inspection surface
with complete safe metadata, accessible detail disclosure, useful loaded-page
search, and stable cursor pagination.

## Requirements

### Requirement: The Action Log exposes only the durable audit allowlist

The `admin.actionLog.list` tRPC procedure and the `/admin` Action Log tab MUST
remain admin-only and read-only. Each returned event MUST contain only the
durable `UserActionLog` allowlist: event id, timestamp, actor user id, actor
role, procedure, target id, success/fail status, sanitized failure reason, IP,
correlation id, and duration. The procedure MUST NOT return raw mutation input,
request or response bodies, before/after objects, or fields outside that
allowlist.

#### Scenario: An admin reads one action-log page

- **WHEN** an authenticated admin queries `admin.actionLog.list`
- **THEN** the response contains a bounded cursor page of allowlisted audit
  events
- **AND** every event contains no property outside the durable allowlist

#### Scenario: A non-admin attempts to read the Action Log

- **WHEN** a lead, head, or viewer calls `admin.actionLog.list`
- **THEN** the canonical role middleware rejects the request as forbidden
- **AND** no audit events are returned

### Requirement: Raw user and transport content never enters the durable event

Mutation auditing MAY inspect decoded input only to derive allowlisted target
identifiers, but the `UserActionLog` write and `admin.actionLog.list` response
MUST NOT retain or expose report or section text, item/risk/decision text,
review comments, user profile values, or external integration content and
identifiers,
authentication material, tokens, cookies, headers, or arbitrary request and
response bodies. A failure reason MUST be a bounded safe classification and
MUST NOT echo raw input or internal database metadata.
Successful events MUST expose a null reason. Failed events MUST expose only a
canonical tRPC failure code. Rows with a non-canonical failure reason MUST be
rejected at the response boundary rather than normalized or exposed.

#### Scenario: A mutation succeeds with sensitive-looking input

- **WHEN** an audited mutation receives representative report text, review
  text, profile values, or integration content and succeeds
- **THEN** its durable event contains only the resolved target identifiers and
  the allowlisted audit metadata
- **AND** none of the input values appears in the persisted row or list response

#### Scenario: A mutation failure references raw or internal values

- **WHEN** an audited mutation fails after receiving raw user content or an
  internal error containing database metadata
- **THEN** the durable failure reason contains only the bounded safe
  classification
- **AND** neither the raw input nor internal database metadata appears in the
  audit stream, durable row, or Action Log response

### Requirement: Each row has an accessible safe-detail disclosure

The `/admin` Action Log table MUST provide a keyboard-operable disclosure for
each row. Its collapsed control MUST expose an accessible name and expanded
state. The expanded content MUST show the full untruncated values of the
allowlisted event fields, and MUST provide a copy action that copies a
deterministic object containing exactly those fields. Copy success or failure
MUST be announced without moving focus or collapsing the row.

#### Scenario: An admin expands and copies one event

- **WHEN** the admin activates a collapsed event-detail control by keyboard or
  pointer
- **THEN** the control reports the expanded state and reveals the full
  allowlisted values associated with that table row
- **AND** activating Copy places only the deterministic allowlisted event object
  on the clipboard and exposes an accessible result message

#### Scenario: The admin collapses an expanded event

- **WHEN** the admin activates the expanded event-detail control again
- **THEN** the detail region is removed from the accessibility tree
- **AND** focus remains on the owning control

### Requirement: Loaded-row search covers displayed audit representations

The `/admin` Action Log search MUST remain explicitly scoped to rows already
loaded by cursor pagination. It MUST match case-insensitively across actor id,
role, raw and humanized procedure, target id, raw and displayed status,
sanitized reason, correlation id, the ISO timestamp, and the timestamp as
displayed in the current locale. It MUST NOT imply server-side or full-history
search.

#### Scenario: An admin searches by displayed timestamp

- **WHEN** the admin enters all or part of a timestamp visible in a loaded row
- **THEN** that row remains in the filtered table
- **AND** a loaded row with no matching displayed or ISO timestamp is excluded

#### Scenario: The next page is loaded while a search is active

- **WHEN** the admin loads another cursor page while the search field is
  non-empty
- **THEN** the same search predicate is applied to the newly loaded rows
- **AND** the UI continues to state that search covers loaded actions only

### Requirement: Action Log pagination is stable and demonstrable

`admin.actionLog.list` MUST return events newest first using a stable composite
cursor order, with a default UI page size of 20. Deterministic seed data MUST
contain more than 20 visible events so the `Load more` transition can be
executed and verified without production data.

#### Scenario: More than one page of real events exists

- **WHEN** the first 20-event page is displayed and a further real event exists
- **THEN** `Load more` is available
- **AND** loading the next page adds the remaining events without a duplicate or
  omission

### Requirement: Action Log counts MUST distinguish loaded rows from visible matches

The Action Log header MUST derive the loaded-row count from all cursor-loaded items. While a non-empty search is active, it MUST separately show the number of visible matches within those loaded items. The existing plus marker MUST continue to indicate an available next page and MUST NOT imply a server total.

#### Scenario: Search filters loaded actions

- **WHEN** an administrator searches twenty loaded actions and two match
- **THEN** the header shows two visible matches and twenty loaded actions
- **AND** the loaded-row marker continues to show whether another cursor page is available

#### Scenario: Search has no match

- **WHEN** a non-empty search matches no loaded action
- **THEN** the header shows zero visible matches without calling zero the loaded count
- **AND** the no-match empty state remains visible

#### Scenario: Another page is loaded

- **WHEN** an administrator loads another cursor page and clears the search
- **THEN** the loaded count increases by the number of appended actions
- **AND** no server total is invented

### Requirement: Displayed procedure labels preserve every action segment

The Action Log MUST produce a readable label from every segment of a valid
dot-separated procedure. The final segment MUST be displayed as the action and
all preceding segments MUST remain visible as its context. Existing
two-segment `Namespace: Action` labels MUST remain unchanged. The raw procedure
MUST remain available in the row title, details, copy output, and loaded-row
search.

#### Scenario: Two nested procedures share context but differ in action

- **WHEN** loaded rows contain `admin.aiProvider.activate` and
  `admin.aiProvider.candidate`
- **THEN** both labels retain the Admin and AI Provider context
- **AND** their final displayed actions are respectively Activate and Candidate

#### Scenario: Existing two-segment procedure is displayed

- **WHEN** a row contains `admin.updateUser`
- **THEN** its label remains `Admin: Update User`

### Requirement: Displayed status labels match the durable status contract

The Action Log status formatter MUST accept the durable event status union
`success | fail`. It MUST display `success` as `OK` and `fail` as `Error`
without maintaining aliases outside the event contract.

#### Scenario: A durable event status is displayed

- **WHEN** an Action Log row has status `success` or `fail`
- **THEN** its status label is respectively `OK` or `Error`

### Requirement: Action Log remains readable at narrow widths

The Actions surface at `/admin?tab=actions` MUST keep each event's timestamp,
actor, procedure, result, and safe-detail disclosure reachable at 375 CSS
pixels without clipped meaningful text or document-level horizontal overflow.
Secondary technical columns MAY be hidden at narrow widths only when their
full allowlisted values remain available through the existing safe-detail
disclosure. Internal horizontal overflow MUST have a visible scroll cue.
The UI MAY show an actor name only from an already available Admin user
snapshot matched by exact user ID; otherwise it MUST display the event's UUID.
Names MUST NOT replace actor IDs in durable events, raw details, or copy output,
and this presentation MUST NOT add a snapshot query or change the audit API.

#### Scenario: An Admin inspects a mobile event

- **WHEN** an Admin opens Actions at 375 CSS pixels
- **THEN** event identity, procedure, result, and its safe-detail control remain readable and reachable
- **AND** expanding details still exposes every full allowlisted value

#### Scenario: An actor name is already available

- **WHEN** an already loaded Admin snapshot contains the event actor's exact user ID
- **THEN** the row may show that user's existing display name
- **AND** the event UUID remains available in details and copy output

#### Scenario: Actions opens without a user snapshot

- **WHEN** direct Actions navigation has no matching already loaded user name
- **THEN** the row shows the actor UUID without fetching names or inventing an identity
