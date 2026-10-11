# Design

## Context

See proposal.md for the observed C1799 failure. `ReportAssistantService` owns a
clock whose `now` getter returns a new Date each time. Existing planner,
retrieval and grounding ports already accept a Date or a clock value, so no
new production seam or public interface is needed.

## Goals / Non-Goals

The authorized-report-retrieval delta defines request-wide date consistency.
Each new request must still observe the current time. Cancellation and provider
failure outcomes remain outside this change.

## Decisions

Capture a plain `{ now: this.clock.now }` at the start of `answerInternal`.
Pass this request-local value to planner, candidate preparation and grounding.
An extra await-time refresh would still let exact filters and aggregates
contradict each other; a service-wide snapshot would become stale across later
requests. A local immutable value uses the existing interfaces and lifetimes.

Before: moving clock → planner → moving clock → filter → provider wait →
moving clock → aggregates.

After: request instant → planner, source selection, filter and aggregates;
provider waits cannot change its calendar classification.

The period lifecycle tuple, canonical role builders and destructive DB guard
are preserved. There are no writes to reports or authorization policy.

## Risks / Trade-offs

- A request crossing midnight describes its start date → the next request
  captures the new date, while the bounded active request remains consistent.
- A future path could read the service clock directly → the public service
  regression crosses midnight after filtering and before grounding.

## Migration Plan

No migration, dependency update or feature flag is needed. Existing web and API
wire contracts stay valid. Deploy through the normal application path after
quick author checks and normal hooks under D42; full checks and one aggregate review follow at program acceptance. Rollback reverts this service change.
