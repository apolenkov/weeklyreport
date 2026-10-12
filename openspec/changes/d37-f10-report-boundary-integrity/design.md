# Design

## Context

See proposal.md. Exact owners/base and all original clauses are in external D37-F10/BRIEF.json. Current nonblank organization, present review text and submit-stage completeness repairs already exist. C3475 enrichment is rejected; C2913 follows the unconditional Item @@unique([reportSectionId, stableId]) and behavioral-ui-regression-gate uniqueness requirement; C4455 fresh native geometry precondition is unavailable here.

## Goals / Non-Goals

Use the existing boundary owner for accepted dates/email, feedback rejection, frozen labels and report UI projection. Preserve same-section Item uniqueness without widening the physical record namespace or cross-section lineage scope; do not invent server promotion, missing configuration default or native proof.

## Decisions

- Before: raw manual dates and myHistory accept values their Report-date siblings reject. After: reuse reportDate while retaining coercion, optionality/null and unrelated timestamps. Altering time-zone or allowed type policy is unnecessary.
- Before: raw feedback URL TypeError reaches server-fault classification. After: local string transform emits a Zod issue, using both current normalization/search operations. Global TypeError classification or total silent normalizer fallback would hide unrelated faults and are excluded.
- Before: reference Map entry overwrites owned frozen metadata. After: existing Map order makes owned labels authoritative. Reference-only and Unknown behavior stay unchanged.
- Before: full-report dedup omits a red-only co-owner from draft count and rendered Leads body. After: each section's existing canonical single-section projection supplies only own red-content eligibility. Keep full escalations for attention and portfolio for authoritative names; a count-only patch cannot satisfy rendered Show all.
- Before: no-data paused pending reaches a no-period notice. After: isPending guards loading and helper requires actual no-period data. Keep dataful refresh and error precedence.
- Before: private email heuristic is weaker than shared wire admission. After: one normalized payload is validated and sent; pending/dirty semantics remain owned by the existing form hook.
- Risk keys use per-display-key occurrence counters without global entity ID/schema changes or array-index keys. Canonical initials replace local approximation. Pure region/totals/scope/token reuse changes no validation values.

- Published Item stableId uniqueness follows prisma/schema.prisma and openspec/specs/behavioral-ui-regression-gate/spec.md (Item uniqueness invariant). Current+Next is one occurrence with nextStepText; replanning creates a later-section occurrence. Root admitted this narrow guard after adviser facts; adviser is not review. Record physical identity remains an orthogonal namespace.

## Risks / Trade-offs

Schema/component public controls prove their local boundary, not API/PG/browser/AT acceptance. Root owns native/full gates and one aggregate review. The existing seven middleware builders/reference-identical leadProcedure, Report lifecycle atomic tuple and destructive-target rules remain untouched.

## Migration Plan

No schema/data migration or feature flag. Root integrates the scoped patch with ordinary hooks; rollback reverses these exact source changes. Main specs/archive remain Root-owned after final acceptance.
