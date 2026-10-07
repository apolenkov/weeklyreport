## Context

See proposal.md and accepted OCR C4114/C4124. The full assignment owner is full-combinations.ts through full-restore.ts, runBatch and pressBatch; factorTarget already preserves requested values.

## Decisions

Keep the native value descriptor and bubbling input/change events inside the existing browser batch, avoiding per-control CLI calls. Pass quick/full mode explicitly in batch options. Validate :disabled (including fieldsets/optgroups), aria-disabled, actual native type and target existence just before dispatch. A stale result carries an explicit reason; quick/full step consumers must not count it as pressed.

## Risks / Trade-offs

DOM can change between planning and action: checking immediately before the synchronous setter bounds that race. Quick can choose another live option only when the original available option is already current. Full never substitutes. No product lifecycle, role middleware or database guard changes; no migration or deployment configuration is needed.
