## Context

See proposal.md and accepted ticket. CodeGraph PageRecord consumers include quick/full producers, worker, compare, coverage and report; merge prefixes serialized paths independently. StepRecord.shot already accepts null.

## Decisions

Widen only PageRecord.shot. Preserve null through worker and merge; keep successful state evidence paths unchanged. A small capture helper validates the external screenshot Step and reports transport/command failures as findings without inventing a PNG. Quick page processing and changed-surface restoration continue after capture failure. Full captures already reject failed commands; failed full page producers return null.

## Risks / Trade-offs

Consumers must distinguish absence from directory paths; scripts TypeScript and owner-level regressions cover direct/worker/merge output. Successful evidence stays intact. Product lifecycle, role coverage and database guards are untouched. No migration or delivery changes; video remains a separate ticket.
