# lead-completion-guidance Specification

## Purpose

Define how the editable lead report communicates whether submission is
possible, what must be fixed, and which unset statuses will be normalized,
while keeping the workflow compact and using the canonical submission path.

## Requirements

### Requirement: The end of the form explains submission in plain language

The editable lead form MUST render a compact, non-sticky summary at the end of
the form that first answers whether the report can be submitted and, when it
cannot, identifies what the lead must fix. Readiness MUST apply the canonical
shared submit validation to the lead's own live draft and the same promoted
payload shape used by submission, including the requirement that every project
in the canonical section has at least one Current Week item and every owned
stage has a non-null status in that promoted payload. Unset own stages MUST
remain eligible for client promotion after the existing warning; raw draft
values MUST NOT introduce a readiness blocker that the promoted payload resolves. Display-only
foreign or referenced products MUST NOT expand that validation denominator. The
summary MUST NOT use `Submit readiness`, a bare `Ready`, or another internal
readiness label as its primary user-facing explanation. It MUST share the
existing readiness derivation and Submit handler rather than introducing a
second validator or submission path.

#### Scenario: The report can be submitted

- **WHEN** no client-side blocker remains and no submission is in progress
- **THEN** the summary says that the report is ready to submit
- **AND** the final Submit action opens the existing confirmation flow

#### Scenario: A current issue blocks submission

- **WHEN** one or more readiness blocking issues exist
- **THEN** the summary tells the lead to complete the listed items before submitting
- **AND** each issue is visible under a `Fix before submitting` heading
- **AND** the final Submit action remains disabled from the shared derivation

#### Scenario: An assigned project has no Current Week item

- **GIVEN** the lead's canonical section includes an assigned project
- **AND** the live own draft has no Current Week item for that project
- **WHEN** submit readiness is derived
- **THEN** readiness shows the canonical missing-current-item validation message
- **AND** the submit confirmation cannot open

#### Scenario: Display-only products do not block submission

- **GIVEN** the visible report includes a foreign or referenced product outside the lead's canonical section projects
- **AND** every project in the canonical section satisfies submit validation
- **WHEN** submit readiness is derived
- **THEN** the display-only product does not add a missing-current-item blocker

#### Scenario: Submission is already in progress

- **WHEN** submission is pending and no content blocker exists
- **THEN** the summary announces that the report is being submitted instead of claiming a generic ready state
- **AND** the final Submit action remains disabled

#### Scenario: unset owned stages are eligible for warned client promotion

- **GIVEN** the live draft has an unset owned stage and no other blocker
- **WHEN** readiness is derived from `buildLeadSubmitPayload`
- **THEN** readiness remains ready to submit and the existing warning identifies the unset stage
- **AND** confirming submission sends that stage as green, satisfying server admission

### Requirement: Automatic status changes are compact and inspectable

When submission will automatically set unset product, activity, or stage
statuses to On Track, the collapsed summary MUST state the total affected count
in one sentence. The detailed identities MUST remain available on demand in a
keyboard-accessible native disclosure, grouped by status kind, and MUST NOT
render as an always-expanded page-length ledger. This presentation MUST NOT
change the existing submit payload or automatic-promotion rules.

#### Scenario: Many statuses will be set automatically

- **WHEN** the current draft has multiple eligible unset statuses
- **THEN** the default summary reports the total number that will be set to On Track
- **AND** the detailed list is closed by default and grouped into products, activities, and stages when opened
- **AND** the end-of-form surface remains compact before the disclosure is opened

#### Scenario: No status will change automatically

- **WHEN** the automatic-promotion list is empty
- **THEN** the status-change disclosure is absent
- **AND** the submission outcome and blockers remain understandable without an empty group

### Requirement: Submission explanation stays in normal flow

The editable Lead Report submission explanation MUST stay at the end of content in normal flow. Completion actions MUST share canonical Submit state and handlers in the header, show pending review count, and use Retry only for autosave recovery, not a permanent Save action. No completion rail, fixed overlay or bottom Submit card MUST cover report content.

#### Scenario: The lead scrolls through a long report

- **WHEN** the header actions leave the viewport
- **THEN** no completion rail appears and report content uses the full viewport height
- **AND** the explanation stays at the end of the content scrollport in normal flow

#### Scenario: Continuations await review

- **WHEN** two suggested continuations are unconfirmed
- **THEN** the header completion actions show `2 to review` beside Submit
- **AND** the end-of-form explanation names the same items and stays in document flow
- **AND** the indicator disappears at zero without adding another banner

### Requirement: Completion layout keeps the content row clear

The Lead Report completion layout MUST give the content scrollport the full row with no action overlay. Content focus scrolling MUST use its own scrollport clearance below the period toolbar. At short viewport heights or high zoom, the layout MUST permit normal document flow instead of trapping content behind the keyboard.

#### Scenario: Keyboard focus passes through the report

- **WHEN** the lead tabs through content
- **THEN** scrolling keeps focused controls visible below the period toolbar
- **AND** the form end remains reachable without fixed-overlay compensation

#### Scenario: A keyboard reduces the visual viewport

- **WHEN** the viewport height is below the layout's short-height breakpoint, including high zoom or an on-screen keyboard
- **THEN** content can flow and scroll in the document instead of a constrained full-height scrollport
- **AND** focused inputs and header completion actions remain reachable

### Requirement: A failed autosave stays visible at the top of the viewport

While the editable Lead draft's autosave is in the error state, a persistent notification at the top of the viewport MUST say the draft is not saved and MUST offer a Retry action that resends the draft through the canonical save path. It MUST stay visible at any scroll position until autosave leaves the error state, then close by itself. Read-only and Slides views MUST NOT raise it. The header Retry remains.

#### Scenario: the lead scrolls while a save has failed

- **GIVEN** autosave of the editable draft has failed
- **WHEN** the lead scrolls the report so the header leaves the viewport
- **THEN** the "Draft not saved" notification with Retry stays visible at the top
- **AND** activating Retry resends the draft immediately

#### Scenario: the draft saves again

- **GIVEN** the "Draft not saved" notification is visible
- **WHEN** a later save succeeds
- **THEN** the notification closes without user action
