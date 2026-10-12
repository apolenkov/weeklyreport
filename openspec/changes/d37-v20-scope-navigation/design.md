# Design

## Context

HeadReportShell changes its URL scope and retains WeeklyReportPage. WeeklyReportBody retains product navigation epochs. ReportAccordionBody previously forwarded a retained product epoch to every lead-scoped copy; resolveExpanded treats any positive epoch as explicit navigation even without matching highlight.

## Goals / Non-Goals

Keep navigation actions scoped to the collection that received them. Preserve author deep links, per-instance DOM IDs, manual disclosure state and repeat product navigation. Do not reset page state, change React keys, infer UUID chronology or add navigation policy.

## Decisions

Pass zero as the product navigation epoch in lead scope. The lead section still consumes lead navigation epochs; product scope still consumes product epochs. The existing keyed parent lists already isolate repeated React children, so their keys stay unchanged.

## Risks / Trade-offs

The public jsdom regression proves the component and transport-fixture boundary. It does not prove native browser routing, scrolling geometry, network or screen-reader announcements. Aggregate checks and independent review belong to Root.

## Validation

Real WeeklyReportPage, existing QueryClient/TRPC harness, schema-validated two-lead/co-owned data. Assert initial lead instances are closed, product overview opens product, then scope transition leaves both lead instances closed; manual opening and later lead navigation retain local disclosure. Existing product disclosure tests cover repeat navigation and reduced motion.
