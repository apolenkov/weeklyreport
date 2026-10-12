## MODIFIED Requirements

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

#### Scenario: Latest destination resolution fails

- **WHEN** the reports/latest destination query transitions into error
- **THEN** the existing error-policy seam logs its event, component and procedure once while its retry and empty-state behavior remain available
