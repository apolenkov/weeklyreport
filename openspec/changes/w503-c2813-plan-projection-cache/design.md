# Design

## Context

See `proposal.md`. The production adapter invokes an invalidation callback only after `mutateAsync` resolves. Existing `invalidateLeadForm` touches only `reports.getActive` and `leadForm.byPeriod`. `LeadStatusOverview` observes `leadForm.statusOverview({ reportId })` with `staleTime: 30_000`; changing a section does not change that report's query key.

## Decisions

Use one `invalidateLeadPlanOutcome` cache helper to retain existing lead-form invalidation and add `trpc.leadForm.statusOverview.pathFilter()` for the three plan commands. It uses the existing private fire-and-forget helper, including rejection logging. The adapter callback does not receive mutation input/output, and a report-section ID is not a report ID; inventing an exact report key or expanding the callback contract would add unnecessary coupling. The procedure-family filter reaches cached report/author variants only in the current authenticated QueryClient.

```text
Before: plan success -> adapter -> getActive/byPeriod invalidation
                                     warm Overview remains fresh
After:  plan success -> adapter -> getActive/byPeriod invalidation
                               -> statusOverview invalidation
                               -> active observer fetch -> updated section
Failure: mutation rejection -> normalized error; no success invalidation
```

Replace the old outcome-only spy assertion with a table of three real adapter commands, each tested for success and rejection. Use a real QueryClient, tRPC client/options proxy and subscribed QueryObserver; fake only the external transport. Warm the query through canonical queryOptions before the write, assert it is fresh, then assert cached/observed section version changes from 1 to 2 without manual invalidation or waiting for the 30-second freshness interval. Existing form-family invalidation and untouched dashboard/openWork data remain checked.

## Risks / Trade-offs

- The procedure-family filter marks other cached Overview variants stale in the same client; this is preferable to a wrong report key and does not cross session boundaries.
- Invalidation preserves asynchronous refetch and error handling; mutation completion does not promise that a failed network refetch delivers fresh data.
- This transport-level cache regression does not establish browser or server integration acceptance. The broader original C2813 clause remains OPEN as specified in `proposal.md`.

## Migration Plan

No migration, feature flag or dependency update. Server writes, the report lifecycle tuple, canonical authorization middleware and destructive guards are unchanged. The only downstream behavior change is refetch of active web Overview queries after the three successes. Coordinator owns final six gates, independent review and delivery; rollback restores the three existing callbacks.
