# period-lifecycle-ui Specification

## Purpose

Define the UI invariants for period lifecycle actions (publish and reopen)
available to head and admin roles. Ensures that leads and viewers never
see mutating controls, that reopen requires explicit confirmation, and that
the period status displayed in the UI matches the canonical enum value in
the database.

The companion `periodStatus` values are `"open"`, `"published"`, and
`"reopened"`; the canonical `periodState` is a separate field (see
[period-dual-state](../period-dual-state/spec.md)). A "locked" period in UI
language maps to `periodState: "published"` with `periodStatus: "published"`.
After a successful reopen, `periodState` returns to `"open"` while
`periodStatus` becomes `"reopened"`.

Consumer surfaces: `period.reopen` tRPC mutation in
`apps/api/src/infrastructure/trpc/trpc.router.ts` (enforced via
`headProcedure`, which is `buildRoleMiddleware(["head", "admin"])` — both
roles are already covered), `PublishLockButton` component in
`apps/web/src/features/period/ui/publish-lock-button.tsx`.

## Requirements

### Requirement: Published Periods Expose a Reopen Action to Head and Admin

Period cards and period-detail views MUST render a "Reopen" action button
on periods whose companion `periodStatus` is `published` when the viewer is a
head or admin. The action
MUST NOT appear on periods whose `periodStatus` is `open`, and MUST NOT appear
for leads or viewers.

#### Scenario: Head views a published period

- **WHEN** a head opens the period list and looks at a period whose
  `periodStatus` is `published`
- **THEN** the period card renders a visible "Reopen" button
- **AND** the button is enabled and clickable

#### Scenario: Admin views a published period

- **WHEN** an admin opens the period list and looks at a period whose
  `periodStatus` is `published`
- **THEN** the period card renders a visible "Reopen" button
- **AND** the button is enabled and clickable

#### Scenario: Head views an open period

- **WHEN** a head opens the period list and looks at a period whose
  `periodStatus` is `open`
- **THEN** no "Reopen" button is rendered on that period card

#### Scenario: Lead views a published period

- **WHEN** a lead opens the period list and looks at a period whose
  `periodStatus` is `published`
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
- **AND** the period list refetches; the period's `periodState` transitions to
  `open` and its `periodStatus` becomes `reopened`

#### Scenario: User cancels the confirmation

- **WHEN** the user clicks "Reopen" and dismisses the dialog
- **THEN** no mutation fires
- **AND** the period remains with `periodStatus: "published"` and
  `periodState: "published"`

### Requirement: Publish Now Requires Confirmation

Clicking "Publish now" on an open period in the Admin Periods list MUST open a
confirmation dialog that states the period is published immediately and Leads
lose edit access. The publish mutation MUST fire only after explicit
confirmation, exactly once per confirmation; the user MUST be able to cancel
without side effects. While the request is pending the dialog MUST NOT be
dismissible and MUST NOT accept a second confirmation.

#### Scenario: User confirms the publish

- **WHEN** the user clicks "Publish now" and confirms in the dialog
- **THEN** the publish mutation fires once for that period
- **AND** on success a toast displays "Period published" and the dialog closes

#### Scenario: User cancels the confirmation

- **WHEN** the user clicks "Publish now" and dismisses the dialog
- **THEN** no mutation fires and the period stays open

### Requirement: Period Navigation Separates Selection From Current Identity

Period navigation MUST label Current only for the report id returned by the
actual active-period read. Opening another report by URL or selecting it in the
navigator MUST change the addressed selection without changing which report is
Current. A displayed report whose canonical `periodState` is `scheduled` MUST
be labelled Scheduled. The client MUST use the server-provided lifecycle state
and MUST NOT infer scheduling state from its clock.

#### Scenario: A future scheduled report is addressed directly

- **GIVEN** an open active report and a different report whose canonical
  `periodState` is `scheduled`
- **WHEN** the scheduled report is opened by its report id
- **THEN** only the active report is labelled Current
- **AND** the addressed report is selected and labelled Scheduled

#### Scenario: Selecting history preserves lifecycle labels and neighbours

- **GIVEN** current, published, archived and scheduled entries in the navigator
- **WHEN** the user selects a different entry or moves with Previous and Next
- **THEN** selection and the neighbouring targets follow the addressed entry
- **AND** Current, Scheduled and Archived labels remain derived from their own
  identity and lifecycle facts

### Requirement: Successful Period Mutations Refresh Period Projections

After a successful publish, reopen, archive, restore, manual create, manual update
or delete action, the client SHALL invalidate report dashboards, current report
and lead-form reads including status overview and open-work history, personal
and compiled history, period lists and the admin
snapshot. Invalidation SHALL cover every cached input variant of these reads.
Period-only changes SHALL NOT invalidate organization or settings queries.

#### Scenario: A report changes lifecycle state while history is cached

- **WHEN** a period mutation succeeds with active and archived history variants cached
- **THEN** both personal and compiled history variants become stale
- **AND** active observers refetch the changed data

#### Scenario: A period changes while period lists are cached

- **WHEN** a period mutation succeeds with multiple period-list states cached
- **THEN** every period-list state and the admin snapshot become stale
- **AND** unrelated organization and settings queries remain fresh

#### Scenario: A period mutation fails

- **WHEN** a period mutation fails
- **THEN** its success refresh and success callback do not execute
