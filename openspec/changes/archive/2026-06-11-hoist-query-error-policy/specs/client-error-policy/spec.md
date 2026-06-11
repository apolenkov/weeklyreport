## ADDED Requirements

### Requirement: Query load failures flow through the policy module

Every TanStack Query load failure on a page surface MUST be reported
(in `apps/web/src/**`) through the error-policy seam
(`useQueryErrorHandler` in `apps/web/src/lib/use-query-error-handler.ts`):
logged via `logClientError` with `component` and `procedure` context,
exactly once per error transition. Components MUST NOT hand-roll
query-error `useEffect` + `logClientError` blocks. Exempt: non-query
synthetic errors (e.g. the dashboard watchdog sites) remain direct
`logClientError` calls.

#### Scenario: a page query fails

- **WHEN** a `useQuery` on a page surface transitions to `isError`
- **THEN** exactly one `logClientError` entry is emitted with the
  site's event, component, and procedure, and it reaches
  `apps/api/.logs/app.log` via the `client-logger.ts` forwarder

#### Scenario: a rerender occurs while the error persists

- **WHEN** the component rerenders (or its context values change)
  while the same error object persists
- **THEN** no additional log entry or toast is emitted

### Requirement: Load-failure toasts use formatClientErrorMessage

Every user-facing load-failure toast MUST be produced by
`formatClientErrorMessage` (prefix + "Reference: \<requestId\>."
suffix, internal-error message suppression). Raw `error.message` MUST
NOT appear in load-failure toast copy.

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
