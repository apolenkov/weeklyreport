# Design

## Context

See proposal.md. `noInvisibleOnly` is the private shared owner used by `safeText` and stage-name elements. `report/report.invisible-text.test.ts` already exercises the real exported primitive and owns the rejection table. The primitive's colocated test currently owns date behavior, so it does not need a second text suite.

## Goals / Non-Goals

Extend the selected-character predicate once. Preserve all accepted string bytes and the stage-name reuse. Do not widen Admin/SAML schema ownership or clean historical records.

## Decisions

Use an explicit character class for the existing set plus the eight selected code points. This keeps the change bounded; using all combining marks or every Unicode format character would alter unrelated valid input. The selected additions appear in Unicode's [Default_Ignorable_Code_Point data](https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt), checked on 2026-10-15. This is a validation predicate, never a string transformation.

```text
report/activity/review/search/assistant input
  → existing shared schema → safeText → noInvisibleOnly → existing consumer
stage-name write array
  → stage-name element ────────────────┘

before: selected invisible-only input passes
after:  selected invisible-only input fails; successful bytes are unchanged
```

An actual write boundary is project-activity create/update: its router validates `projectActivityCreateSchema`/`projectActivityUpdateSchema`, whose name and Jira-account fields use `safeText`. Admin catalog product names instead use `adminProjectSchema.name = z.string().min(1)` and bypass this primitive. That residual and the original C3679 length/label scope stay open.

Period lifecycle, canonical authorization chains, foreign keys and destructive guards are unchanged.

## Risks / Trade-offs

- Existing stored invisible-only values would newly fail shared read validation → disclose the compatibility change; `c108-stored-text-read-compat` later separated stored reads from this write rule, so the current contract keeps the rejection on writes only. No cleanup or recovery runtime is included.
- Overbroad Unicode rejection could damage multilingual text → test exact-byte preservation, combining marks, embedded formatting and emoji joiners.
- Stage names share the write predicate → exercise the write array export (current reads use the stored-text field kind since `c108-stored-text-read-compat`), preserving optionality and bounds.

## Migration Plan

No schema migration or dependency change. Run real primitive RED before changing the predicate, focused caller suites after repair, then exact-SHA Air six gates and independent Claude review arranged by Root. Normal atomic delivery follows acceptance; rollback reverts this bounded predicate change.
