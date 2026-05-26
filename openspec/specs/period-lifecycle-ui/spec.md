# period-lifecycle-ui Specification

## Purpose

TBD - created by archiving change fix-period-reopen-ui. Update Purpose after archive.

## Requirements

### Requirement: Closed Periods Expose a Reopen Action to Head and Admin

Period cards and period-detail views MUST render a "Reopen" action button
on closed periods when the viewer is a head or admin. The action MUST
NOT appear on open periods, and MUST NOT appear for leads or viewers.

#### Scenario: Head views a closed period

- **WHEN** a head opens the period list and looks at a period whose state is `closed`
- **THEN** the period card renders a visible "Reopen" button
- **AND** the button is enabled and clickable

#### Scenario: Head views an open period

- **WHEN** a head opens the period list and looks at a period whose state is `open`
- **THEN** no "Reopen" button is rendered on that period card

#### Scenario: Lead views a closed period

- **WHEN** a lead opens the period list and looks at a closed period
- **THEN** no "Reopen" button is rendered (lead is not authorized to reopen)

### Requirement: Reopen Action Requires Confirmation

Clicking the "Reopen" button MUST open a confirmation dialog that
explains the consequence ("Leads will regain edit access"). The reopen
mutation MUST fire only after explicit confirmation; the user MUST be
able to cancel without side effects.

#### Scenario: User confirms the reopen

- **WHEN** the user clicks "Reopen" and confirms in the dialog
- **THEN** the reopen mutation fires
- **AND** on success a toast displays "Period reopened"
- **AND** the period list refetches; the period's state transitions to `open`

#### Scenario: User cancels the confirmation

- **WHEN** the user clicks "Reopen" and dismisses the dialog
- **THEN** no mutation fires
- **AND** the period remains in `closed` state
