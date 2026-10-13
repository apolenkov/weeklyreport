# Design

## Context

See proposal.md for the motivation. The administrator detach operation removes editable ActivityStatus rows but leaves valid activity-linked records. The Head strip currently derives all cards from those status rows. The weekly field editor can retain pending text across a server refresh while its saved base advances. Request changes currently renders Error.message directly, although a shared mutation error helper already handles serialized Zod issues.

## Goals / Non-Goals

Preserve existing saved content and prevent overwriting newer weekly fields through the existing public UI. Keep recovery within Cancel and reopening. No API, schema, lifecycle, authorization, logging, dependency, or migration changes; no automatic merge or invented catalogue metadata.

## Decisions

1. Build the unavailable-details group from unmatched activity-backed records per section author, reusing existing record presentation. An unavailable status is explicitly absent, never a normal traffic-light value. Rejecting detach or synthesizing catalogue metadata would change the API or misrepresent saved data.
2. Compare normalized title/description pairs against the saved base retained while dirty. A difference blocks both the button and submit handler and preserves pending text. Catalogue names are excluded. Cancel deliberately discards pending text; reopening adopts current saved values. A new version owner or merge flow is unnecessary for the approved behavior.
3. Use the existing mutation error helper in RequestChangesDialog. Validate the public transport consumer with invisible-only input; preserve meaningful domain errors. Other raw-message sites require independent producer evidence and remain tracked.

## Data flow

```text
Before: saved activity records -> detach -> mapped records without status -> strip omits records
After:  same public API flow -> strip groups unmatched records as details unavailable

Before: dirty A -> refresh B/version2 -> submit old fields with latest version
After:  dirty A + original base -> refresh B -> warning + blocked submission -> Cancel -> reopen B

Before: review.verdict validation -> serialized message -> dialog raw issue array
After:  same response -> existing error helper -> readable dialog copy + retained reason
```

## Risks / Trade-offs

- Catalogue details remain unavailable -> preserve record text and author without inventing a name/status.
- A stale editor cannot save its pending text directly -> warning explains Cancel and reopening; no silent merge.
- Focused UI tests do not prove database persistence or complete visual acceptance -> guarded public producer/readback and full screenshots at 1280 and 375 are separate evidence.
- Broader clauses in the 18-ID card may lack producer evidence -> keep them open with real follow-up tracking rather than infer closure.

## Migration Plan

No migration or feature flag is needed. Deploy the web changes with existing API contracts. Roll back the web commit if required. Period dual-state, canonical middleware identity, and destructive database guards remain unchanged. Native tests use the allocated synthetic lane behind the existing guard and explicit seed.
