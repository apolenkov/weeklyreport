# Spec: Client Error Policy

## Purpose

Pin the durable contract that every TanStack Query load failure on a page
surface is reported through one error-policy seam and logged exactly once,
rather than via hand-rolled per-component effects. Governs the reporting
seam, not error copy.

## Requirements

### Requirement: Query load failures flow through the policy module

Every TanStack Query load failure on a page surface MUST be reported
(in `apps/web/src/**`) through the error-policy seam
(`useQueryErrorHandler` in `apps/web/src/shared/hooks/query/use-query-error-handler.ts`):
logged via `logClientError` with `component` and `procedure` context,
exactly once per error transition. Components MUST NOT hand-roll
query-error `useEffect` + `logClientError` blocks. Exempt: non-query
synthetic errors (e.g. the dashboard watchdog sites) remain direct
`logClientError` calls.

#### Scenario: a page query fails

- **WHEN** a `useQuery` on a page surface transitions to `isError`
- **THEN** exactly one `logClientError` entry is emitted with the
  site's event, component, and procedure, and it reaches the configured
  application log sink via the `client-logger.ts` forwarder

#### Scenario: a rerender occurs while the error persists

- **WHEN** the component rerenders (or its context values change)
  while the same error object persists
- **THEN** no additional log entry or toast is emitted

### Requirement: Load-failure toasts use formatClientErrorMessage

Every user-facing load-failure toast MUST be produced by
`formatClientErrorMessage` (prefix + "Reference: \<requestId\>." suffix,
internal-error message suppression). Raw `error.message` MUST NOT appear in
load-failure toast copy.

This explicitly covers **client-input validation failures** (a tRPC
`BAD_REQUEST` whose `error.message` is a serialized Zod issues array) and
**not-found failures** (`NOT_FOUND`): these are non-internal errors, but their
`error.message` MUST NOT be echoed into toast copy either. The formatter MUST
map such errors to a clean human message (e.g. an invalid-link / not-found
message), never the raw issues array or its regex `pattern`.

The formatter MUST map malformed identifiers to the safe client-facing error
message for both `leadForm.byPeriod` and `weeklyReport.get`; raw Zod issue
details MUST remain internal.

#### Scenario: an internal server error with a requestId

- **WHEN** a toasting query site fails with an internal tRPC error
  carrying `requestId: "req-X"`
- **THEN** the toast reads "\<prefix\>. Reference: req-X." and does
  not echo the internal error message

#### Scenario: a silent surface fails

- **WHEN** a query on a log-only surface (slides clients, which pass
  no `toastPrefix`) fails
- **THEN** the failure is logged but no toast is shown; the surface's
  own empty state is the user signal

#### Scenario: a client-input validation failure (Zod / BAD_REQUEST)

- **WHEN** a toasting query site fails with a tRPC `BAD_REQUEST` whose
  `error.message` is a serialized Zod issues array (e.g. a malformed
  `reportId` that fails the UUID check)
- **THEN** the toast shows a clean human message (invalid link / not found)
- **AND** the raw issues array, its `pattern` regex, and any internal Zod
  field MUST NOT appear in the toast copy

#### Scenario: A non-internal error carries a Reference

- **WHEN** a non-internal, non-invalid-link load error carries a requestId
- **THEN** the displayed message ends with sentence punctuation before its Reference suffix
- **AND** a message already ending with sentence punctuation does not receive another period

#### Scenario: A message-free error carries a Reference

- **WHEN** a message-free load error carries a requestId
- **THEN** the prefix ends with a period before its Reference suffix
- **AND** existing internal-error suppression, invalid-link copy and no-reference copy remain unchanged

### Requirement: Deterministic client errors are not retried

The query client MUST NOT retry a query load failure that carries a
deterministic client-error HTTP status (4xx). The TanStack Query client
(`apps/web/src/shared/lib/query/query-client.ts`) MUST set a `retry` predicate that returns
`false` for any 4xx so a deterministic `BAD_REQUEST` (e.g. a malformed
`reportId`) fails once, not three additional times.

Deterministic client errors from the `byPeriod` batch MUST not be retried;
transient failures may retain the configured retry policy.

#### Scenario: a query fails with a deterministic 4xx

- **WHEN** a page-surface query fails with an HTTP 4xx (e.g. 400 from a
  malformed `reportId`)
- **THEN** the query is not retried (a single attempt, then the error surface)

#### Scenario: a query fails with a transient 5xx

- **WHEN** a page-surface query fails with an HTTP 5xx or a network error
- **THEN** the existing retry behavior is preserved (the 4xx-skip predicate
  does not suppress transient-error retries)

### Requirement: A composed page reports one query failure once

When several components on one page surface read the same query, exactly
one of them MUST register the error-policy handler for it, so a single
failure of that query emits one `logClientError` entry and at most one toast
on that page.

#### Scenario: the active report fails to load on the lead status overview

- **WHEN** `reports.getActive` fails while the lead status overview and its
  lead-form editor are mounted
- **THEN** exactly one log entry for `reports.getActive` is emitted
- **AND** at most one "Failed to load active report" toast is shown
