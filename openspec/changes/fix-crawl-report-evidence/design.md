## Context

See proposal.md and accepted low-priority tickets. Worker owns recording commands; merge prefixes video references; report already supports absence through truthiness. Report.runRow owns sorted response samples.

## Decisions

Widen RunRecord.video only. Keep recording transport in the existing named browser, validate external command results and return null on failed start/stop. Recording cleanup is attempted after page traversal even when traversal throws; failures are findings. Existing report absence remains none; merge preserves null.

Use the empirical nearest-rank index ceil(P95*N)-1 on non-null samples. Include n next to the percentile and use not measured for empty samples, preserving real zero. No new quantile library or response-time formula changes.

## Risks / Trade-offs

A capture path is claimed only after successful completion. Recording and response regressions use actual worker/report owners with external CLI boundary doubles, retaining filesystem evidence. Product lifecycle, role coverage and database guards are unchanged. No migrations or delivery changes.
