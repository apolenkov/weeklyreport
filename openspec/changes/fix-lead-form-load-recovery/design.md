## Context

See `proposal.md` for the user-visible gap. The lead form already owns all
report-scoped queries in `useLeadFormData`, and `useLeadFormReports` already
retains both the `leadForm.byPeriod` query result and its `refetch` function.
The top-level `LeadForm` currently reduces every unresolved loaded view to
`LeadFormSkeleton`, so a terminal query error is indistinguishable from an
in-flight load.

## Goals / Non-Goals

**Goals:**

- Expose the primary section-read error and retry capability through the
  existing feature-local data boundary.
- Render one explicit, accessible terminal state before draft derivation.
- Preserve the centralized query-error logging and toast policy.

**Non-Goals:**

- No new API procedure, global error component, retry policy, or persistence
  behavior.
- No change to auxiliary-query handling for history, view settings, or
  cross-author data.

## Decisions

### Keep failure state in the existing data boundary

`useLeadFormReports` will expose a narrow primary-read status and the existing
retry operation as plain view data. `LeadForm` will branch on that status
before resolving or rendering loaded draft content.

Alternative: inspect TanStack Query state directly in `LeadForm`. Rejected
because it would leak query-library state across the extracted data-loading
boundary defined by `lead-form-data-loading`.

### Fail closed for editable content

Any current `leadForm.byPeriod` error will render the terminal state, even if
the query cache still contains older data. This prevents a background failure
from leaving stale content editable under a successful-looking shell.

Alternative: retain cached data and show only a toast. Rejected because it
does not satisfy the R41 recovery contract and makes data freshness ambiguous.

### Reuse the query's refetch operation

The `Retry` action will call the existing section refetch function. The error
state will remain visible while retry is in flight and will be replaced only
after a successful response. The component will prevent duplicate retry
actions while the request is pending.

Alternative: reload the browser route. Rejected because it is slower, loses
client context, and bypasses the existing query lifecycle.

### Preserve load-bearing invariants

The change is read-only. It preserves period dual-state, the role-coverage
middleware gate, the destructive-database guard, and the deferred-feature
pattern. It changes no API or shared schema and adds no rollout flag.

## Risks / Trade-offs

- [A background refetch error temporarily hides cached content] -> This is an
  intentional fail-closed choice; Retry restores content only from a confirmed
  successful response.
- [Repeated clicks issue duplicate refetches] -> Disable Retry while the query
  is fetching and test the disabled state.
- [The toast duplicates the inline state] -> Keep the toast as the global
  diagnostic signal and the inline state as the persistent recovery surface;
  test that the existing error-policy call remains intact.

## Migration Plan

No data or API migration is required. Deploy the web change with its focused
tests. Rollback is the reversal of the web-only commit; no stored state is
affected.
