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
review comments, user profile values, Telegram content or chat identifiers,
authentication material, tokens, cookies, headers, or arbitrary request and
response bodies. A failure reason MUST be a bounded safe classification and
MUST NOT echo raw input or internal database metadata.
Successful events MUST expose a null reason. Failed events MUST expose only a
canonical tRPC failure code or the `LEGACY_FAILURE` classification used when an
older row contains a non-canonical reason.

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

#### Scenario: An older failure row contains an arbitrary reason

- **WHEN** `admin.actionLog.list` reads a pre-change failed event whose stored
  reason is not a canonical failure code
- **THEN** the response exposes `LEGACY_FAILURE` instead of the stored text
- **AND** the original value remains inaccessible through the Action Log API

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
