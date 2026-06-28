# period-lifecycle-authz Specification

## Purpose

Define the authorization and target-resolution contract for the period
lifecycle mutations `period.publish` and `period.reopen` in
`apps/api/src/infrastructure/trpc/trpc.router.ts`, enforced by
`apps/api/src/modules/period/period.service.ts`. A head may only act on the
server-derived active period; an arbitrary `reportId` is reserved for `admin`;
archived periods are never a valid target. This complements `period-lifecycle-ui`
(UI rendering and confirmation) and `period-dual-state` (atomic dual-field
writes); neither governs which period a mutation may target.

## ADDED Requirements

### Requirement: Head Publish Targets the Server-Derived Active Period

The `period.publish` mutation, when invoked by a `head` (non-admin), SHALL act
only on the period resolved server-side as the current active editable period,
not on an unvalidated client-supplied `reportId`. A `head` request whose
`reportId` does not equal the resolved active editable period SHALL be rejected
with a typed domain error; the service MUST NOT silently retarget to the active
period.

The active editable period is the newest non-archived report with
`periodStatus` in `{open, reopened}` and `periodStart <= now`, matching the
`getCurrentEditableId` semantics in
`apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`.

#### Scenario: Head publishes the active editable period

- **GIVEN** a head session and the server resolves report `R` as the current
  active editable period
- **WHEN** the head calls `period.publish` with `reportId = R`
- **THEN** the service publishes report `R`
- **AND** the publish telemetry counters increment exactly once

#### Scenario: Head publishes a stale or foreign reportId

- **GIVEN** a head session and the server resolves report `R` as the current
  active editable period
- **WHEN** the head calls `period.publish` with a `reportId` other than `R`
  (a closed, future, or unrelated period)
- **THEN** the service rejects the request with a typed domain error mapped to
  `FORBIDDEN`
- **AND** no period is published and no telemetry counter increments

#### Scenario: No active editable period exists

- **GIVEN** a head session and the server resolves no current active editable
  period
- **WHEN** the head calls `period.publish` with any `reportId`
- **THEN** the service rejects the request with a typed domain error
- **AND** no period is published

### Requirement: Head Reopen Targets the Server-Derived Latest Published Period

The `period.reopen` mutation, when invoked by a `head` (non-admin), SHALL act
only on the server-derived latest published, non-archived period, not on an
unvalidated client-supplied `reportId`. A `head` request whose `reportId` does
not equal the resolved target SHALL be rejected with a typed domain error; the
service MUST NOT silently retarget.

The `period.reopen` procedure MUST thread `ctx.session` into the service so the
role and scope are available for this decision; today the procedure calls the
service without the session.

The latest-published resolver used for this decision MUST exclude archived rows
(`archived = false`). It therefore diverges from the shared
`getLatestPublishedId` in
`apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`, which
filters only `periodStatus = 'published'` and would otherwise resolve the target
to an archived id when the newest published row is archived — wrongly blocking a
head from reopening the newest non-archived published period.

#### Scenario: Latest published period is archived

- **GIVEN** a head session, the newest `published` report is archived, and an
  older `published` report `R` is non-archived
- **WHEN** the head calls `period.reopen` with `reportId = R`
- **THEN** the server resolves the latest published non-archived period as `R`
  and reopens it
- **AND** the archived rejection does not block this reopen

#### Scenario: Head reopens the latest published period

- **GIVEN** a head session and the server resolves report `R` as the latest
  published non-archived period
- **WHEN** the head calls `period.reopen` with `reportId = R`
- **THEN** the service reopens report `R` (subject to the existing reopen-policy
  window and master-switch gates, which are unchanged)

#### Scenario: Head reopens a non-current published reportId

- **GIVEN** a head session and the server resolves report `R` as the latest
  published non-archived period
- **WHEN** the head calls `period.reopen` with a published `reportId` other
  than `R`
- **THEN** the service rejects the request with a typed domain error mapped to
  `FORBIDDEN`
- **AND** no period is reopened

### Requirement: Archived Periods Are Never a Valid Lifecycle Target

The `period.publish` and `period.reopen` mutations SHALL reject any target
whose underlying report is archived (`archived = true`), for every role
including `admin`, with a typed domain error mapped to `FORBIDDEN`. An archived
period MUST first be unarchived through the admin path before any publish or
reopen is permitted.

#### Scenario: Reopen an archived published period

- **GIVEN** an archived report whose `periodStatus` is `published`
- **WHEN** any role calls `period.reopen` for that report
- **THEN** the service rejects the request with a typed domain error mapped to
  `FORBIDDEN`
- **AND** no reopen occurs

#### Scenario: Publish an archived period

- **GIVEN** an archived report
- **WHEN** any role calls `period.publish` for that report
- **THEN** the service rejects the request with a typed domain error mapped to
  `FORBIDDEN`
- **AND** no publish occurs

### Requirement: Arbitrary reportId Period Lifecycle Mutations Are Admin-Only

An `admin` SHALL be permitted to target any non-archived `reportId` in
`period.publish` and `period.reopen`, bypassing the active-period equality
check that constrains heads. This supports the admin period-management UI
(`apps/web/src/components/admin/use-period-mutations.ts`), the only legitimate
arbitrary-target caller. The archived-period rejection still applies to admin.

#### Scenario: Admin reopens an older published period

- **GIVEN** an admin session and a non-archived published report `R` that is
  not the latest published period
- **WHEN** the admin calls `period.reopen` with `reportId = R`
- **THEN** the service reopens report `R` without the active-period equality
  check applied to heads

#### Scenario: Admin publishes a specific editable period

- **GIVEN** an admin session and a non-archived editable report `R`
- **WHEN** the admin calls `period.publish` with `reportId = R`
- **THEN** the service publishes report `R` without the active-period equality
  check applied to heads

### Requirement: Out-of-Scope Targets Surface as Typed Domain Errors

Authorization and target-scope denials in `period.publish` / `period.reopen` SHALL be raised as typed domain errors, never as a generic server fault. They are mapped in
`apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` to the appropriate tRPC
code (`FORBIDDEN` for an out-of-scope or archived target, `NOT_FOUND` for a
missing report), never surfaced as a generic `INTERNAL_SERVER_ERROR`. Internal
detail MUST NOT leak in the client-facing message.

#### Scenario: Head out-of-scope publish maps to FORBIDDEN, not 500

- **GIVEN** a head whose publish `reportId` is not the active editable period
- **WHEN** the request is processed and the typed domain error is raised
- **THEN** the tRPC error code is `FORBIDDEN`, not `INTERNAL_SERVER_ERROR`
- **AND** the client message names the denial without exposing internal state

#### Scenario: Missing report maps to NOT_FOUND

- **GIVEN** a `reportId` that does not exist
- **WHEN** any role calls `period.publish` or `period.reopen` for it
- **THEN** the tRPC error code is `NOT_FOUND`
