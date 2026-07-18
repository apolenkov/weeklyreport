## ADDED Requirements

### Requirement: Lead Section Provisioning Is Atomic

`ensureLeadSection` MUST create the `ReportSection` row and seed its
`ProjectStatus` and `ActivityStatus` rows in a single transaction. A failure
in either seed step MUST NOT leave a `ReportSection` committed without its
seeded status rows.

#### Scenario: A seed failure leaves no section committed

- **WHEN** `seedProjectStatuses` or `seedActivityStatuses` throws during
  `ensureLeadSection`
- **THEN** no `ReportSection` row for that report/user pair is committed
- **AND** a retried call to `ensureLeadSection` can seed successfully instead
  of finding an already-existing, permanently-unseeded section

### Requirement: `reports.myHistory` Maps Domain Errors

The `reports.myHistory` tRPC procedure MUST route any error from
`reportSectionsService.myHistory` through `mapDomainError`, consistent with
every other procedure in `reports.router.ts`.

#### Scenario: A domain error surfaces with its typed code

- **WHEN** `reportSectionsService.myHistory` throws a domain error
- **THEN** the `myHistory` procedure's caller receives the error's mapped
  tRPC code, not a generic `INTERNAL_SERVER_ERROR`

### Requirement: Admin Ops Procedures Fail Loud On Unwired Dependencies

`admin.dlqCount` and `admin.jobs.retryFailed` MUST throw when their
underlying dependency (`emailReminderQueue` / `jobsService`) is undefined,
the same way `requireActionLogService` already throws for
`admin.actionLog.list`. Neither procedure MAY return a fail-soft default
(`0` / a silent no-op) when its dependency is missing.

#### Scenario: `dlqCount` throws when its queue is unwired

- **WHEN** `admin.dlqCount` is called and `deps.emailReminderQueue` is
  undefined
- **THEN** the procedure throws, rather than returning `0`

#### Scenario: `retryFailed` throws when its service is unwired

- **WHEN** `admin.jobs.retryFailed` is called and `deps.jobsService` is
  undefined
- **THEN** the procedure throws, rather than silently no-op-ing

### Requirement: The Client-Logs Web Proxy Caps Body Size

The Next.js `/api/client-logs` route MUST reject a request body larger than
a named size limit before buffering it via `req.text()`, matching the api
side's existing `128kb` cap.

#### Scenario: An oversized client-log batch is rejected at the web hop

- **WHEN** an unauthenticated caller POSTs a body larger than the configured
  limit to the web `/api/client-logs` route
- **THEN** the route rejects it without forwarding to the api

### Requirement: `useScrollFade` Recomputes On Content Growth

`useScrollFade` MUST recompute its fade affordance when the observed
container's CONTENT changes size, not only when the container element
itself is resized.

#### Scenario: Content grows without a container resize

- **WHEN** child content is appended inside a fixed-height scroll container
- **THEN** `useScrollFade`'s `canScrollDown` recomputes to reflect the new
  scrollable content, even though the container's own box size didn't
  change

### Requirement: Carry-Over `recordType` Uses The Correct Discriminant

The carry-over repository's `recordType` derivation MUST key off the field
that actually discriminates an item record from a decision record, and MUST
NOT rely on a field that can be legitimately null for either record type.

#### Scenario: A record with a null incidental field still classifies correctly

- **WHEN** a carry-over record's non-discriminant nullable field is null
- **THEN** `recordType` is still derived correctly from the true
  item/decision discriminant

### Requirement: The Destructive-DB Guard Parses `DATABASE_URL` Robustly

`assertNonProdDestructive`'s host extraction MUST use a standards-compliant
URL parser (`new URL(...)`) rather than a hand-rolled regex, so a
credential-less connection string is parsed correctly.

#### Scenario: A credential-less `DATABASE_URL` still resolves its host

- **WHEN** `DATABASE_URL` has no `user:pass@` segment (e.g.
  `postgresql://host/db_test`)
- **THEN** the guard correctly extracts `host` and applies its existing
  allow/refuse rules
