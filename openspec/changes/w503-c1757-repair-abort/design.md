# Design

## Context

See `proposal.md`. `ReportAssistantService.answer` combines the acquired lease signal and its existing request-deadline signal. `planWithOneRepair` checks cancellation after initial planning, but validates the awaited repair result without another check. Malformed repair returns an internal `invalid_plan`; the outer service checks only lease loss before returning it. Deadline mapping in `failureOutcome` therefore never runs. The earlier lease-loss probe already passed on unchanged production code because that outer guard catches it.

## Decisions

Store the awaited repair result, call `signal?.throwIfAborted()` immediately, and then parse it. This matches the initial-plan and citation-repair patterns and routes cancellation through the existing public outcome mapper. Checking only the service's malformed-plan branch would leave the shared orchestration pattern inconsistent and mix cancellation into validation handling.

```text
Before: deadline -> combined signal aborted
        late malformed repair -> parse -> internal invalid_plan
        live lease -> outer lease check passes -> public invalid_plan
After:  deadline -> combined signal aborted
        late repair -> post-await abort check -> existing catch
        deadline mapping -> public provider_unavailable -> lease release
Control: lost lease -> resource_limited; uncancelled malformed -> invalid_plan
```

The test delegates planner repair to the real `OpenAiCompatiblePlannerAdapter` and `OpenAiCompatibleTransport`. Only the existing injectable fetcher is controlled: it pauses, exposes the actual fetch signal, and returns HTTP 200 with a valid tool envelope after fake timers advance by `REPORT_ASSISTANT_REQUEST_DEADLINE_MS`. The tool's arguments are valid JSON containing the invalid plan `{ unexpected: true }`; `{}` is a valid defaulted compact plan and cannot exercise this branch. The test proves the fetch signal is aborted, the lease is live, and the real adapter resolves the invalid plan before checking the public outcome. It does not manually abort the deadline or make the mock throw. Actual RED is the public `invalid_plan` versus expected `provider_unavailable`; the existing ordinary-invalid-plan case and lease-loss case remain controls. One adapter repair and one fetch prove no retry or additional provider request starts.

## Risks / Trade-offs

- A provider that never settles despite cancellation remains outside this fix; no promise-racing or transport protocol is added.
- Fake timers and an injected fetcher exercise the production deadline callback, service, adapter and transport together. This is injected-fetcher integration, not native fetch or real-network evidence; the coordinator accepts that boundary and owns independent review.
- The helper now rejects cancellation before parsing a late repair; public lease-loss precedence and the existing typed deadline mapping remain unchanged.

## Migration Plan

No schema, flag, dependency or configuration change. Report dual-state, canonical role middleware and destructive database guards are untouched. The web consumes the existing `provider_unavailable` outcome. Coordinator runs the six repository gates, independent review and normal-hook delivery; rollback restores the pre-check repair parsing.
