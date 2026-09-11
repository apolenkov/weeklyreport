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
in the canonical section has at least one Current Week item. Display-only
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

### Requirement: Sticky actions and submission explanation stay separate

The submission explanation MUST remain in normal document flow at the end of
the editable form. Only the existing compact Save/Add/Submit action cluster MAY
be sticky, and it MUST preserve content clearance and safe-area behavior rather
than turning the explanatory summary into a persistent banner.

#### Scenario: The lead scrolls through a long report

- **WHEN** the canonical header actions leave the viewport
- **THEN** the existing compact action cluster may appear according to its visibility contract
- **AND** the end-of-form submission explanation remains in document flow without covering report content
