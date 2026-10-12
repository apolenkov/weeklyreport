# Design

## Context

`ReportAssistantService.answer` uses authorized section scopes to resolve references before exact retrieval. Live Activity presentation retains `titleOverride`; published snapshots already freeze the effective title into `activityName`. ContextBuilder budgets evidence against a serialized shape that includes complete aggregates, but does not check the final evidence-free shape.

## Goals / Non-goals

Resolve visible authorized Activity references and enforce the existing estimated grounding budget. Preserve complete counts, grouping, published labels, foreign-section filtering, configured limits and lease cleanup. Provider token accounting, history selection and new model policies are outside this correction.

## Decisions

Before: catalogue-only activity aliases -> unknown weekly reference -> no results.
After: effective title plus catalogue alias within existing authorized scopes -> same stable activity identity -> exact retrieval. The catalog label uses `titleOverride?.trim() || activityName`, consistent with publication. Snapshot names are consumed as stored.

Before: evidence cannot fit -> empty evidence with oversized aggregates -> answer provider.
After: construct unchanged complete aggregates and bounded evidence -> estimate the final existing prompt shape -> typed internal budget exception when oversized -> existing `result_set_too_large` without answer/repair calls. The existing failureOutcome owner maps only that domain exception after lease/deadline checks and before provider mapping. General failure telemetry and request lease cleanup retain their existing route.

## Risks / Trade-offs

The estimate remains the existing character-based serialized grounding estimate; it does not guarantee provider token consumption. No aggregate is dropped to meet it. Source fixtures prove the public application boundary, while provider, database and native acceptance remain Root-owned and unproved here.

## Verification

Genuine old-product public service RED: weekly references return no_results; low configured budget reaches answer/citation repair. Controls cover catalogue/null/absent names, normalized references, foreign privacy, full aggregate groups and lease release. Run the same file GREEN, existing domain/stage controls, scoped lint, formatting and strict OpenSpec validation. Root runs aggregate gates and independent review.
