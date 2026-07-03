# Per-file audit — apps/api/src/modules/review (2026-07-02)

Read-only calibration audit, wave 1 of the per-file series (companion to the other `docs/audit/wave1/*` reports).
6 files scanned in `apps/api/src/modules/review`.
11 findings kept, 0 killed by verification.

## review-actions.service.ts (2 findings)

| Lines          | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                                       | Suggestion                                                                                                                                                  | Your verdict |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 55-59, 103-107 | parameters | medium   | `ReviewActionsRepository.acknowledge(userId: string, reportId: string, groupId: string)` — three adjacent same-typed string positional params, called positionally. Nothing stops a transposed call; TS can't catch it since all three are `string`. Duplicated in the Prisma implementation. | Collapse to `acknowledge({ userId, reportId, groupId })`; update interface, Prisma implementation, and call site.                                           |              |
| 89-94          | comments   | low      | 6-line JSDoc header on `ReviewActionsService` exceeds the 3-line budget, narrating the write surface and router/service authorization split instead of a single non-obvious WHY.                                                                                                              | RELOCATE: fold the write-surface/authorization-split description into the review capability's openspec spec; leave a <=2-line pointer comment on the class. |              |

Already good: verdict()/comment() input shapes are already correctly modeled as options objects, and `PostVerdictParams`/`VerdictContext` are named interfaces rather than inline object-literal types; authorization predicates live in `review-authz.ts` and every repository result is re-validated against the shared Zod schema before returning.

## review-actions.prisma-repository.ts (2 findings)

| Lines   | Dimension  | Severity | Finding                                                                                                                                                                                                           | Suggestion                                                                                                                                | Your verdict |
| ------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 34-38   | parameters | medium   | Prisma implementation of `acknowledge(userId, reportId, groupId)` mirrors the same 3-adjacent-same-typed-string violation as the interface.                                                                       | Same fix as the interface: switch to a single `{ userId, reportId, groupId }` options object.                                             |              |
| 206-209 | comments   | low      | 4-line comment on the `changes_requested` auto-un-submit path explaining reuse of `applyRevokeTransition` and its atomicity/optimistic-lock guarantee — genuinely load-bearing but 1 line over the 3-line budget. | RELOCATE: move the concurrency-safety argument next to `applyRevokeTransition`'s own doc or an ADR; trim this site to a <=2-line pointer. |              |

Already good: `postVerdict`'s un-submit path reuses the existing `applyRevokeTransition` (report-sections/revoke-transition.ts) inside the same `$transaction` instead of re-implementing the status/version guard — the same helper is also reused by `lead-form.prisma-repository.ts`, so the field-set/guard logic has exactly one home; `loadAnchorSectionGroup` + `groupIdOf` cleanly factor the itemId/riskId/decisionId three-way dispatch into one small private helper with no duplicated Prisma select shape.

## review-authz.ts (3 findings)

| Lines                                                | Dimension  | Severity | Finding                                                                                                                                                                                                                                                         | Suggestion                                                                                                                | Your verdict |
| ---------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 34-43 (call site: review-actions.service.ts:205-212) | parameters | medium   | `isDesignatedReviewer(session, groupId, canReviewFlag: boolean)` takes a trailing boolean flag as a positional param and sits at 3 positional params. The call site passes a named variable, so the harm is milder than a bare literal, but both triggers fire. | Wrap as `isDesignatedReviewer(session, { groupId, canReviewFlag })` so the flag is self-documenting at every call site.   |              |
| 12-18                                                | comments   | low      | 7-line JSDoc on `scopeCoversGroup` exceeds the 3-line budget. It's load-bearing coordination rationale (must derive from the same source as `groupScopeFilter` to avoid drift) but written as narrative prose in the header.                                    | RELOCATE: move the full rationale to the group-scope authorization spec/ADR; leave a <=2-line pointer here.               |              |
| 27-33                                                | comments   | low      | 7-line JSDoc on `isDesignatedReviewer` exceeds the 3-line budget with similar load-bearing authorization rationale (why designation is keyed strictly per-group).                                                                                               | RELOCATE: move the detailed reviewer-designation rule to the review capability's spec/ADR; leave a <=2-line pointer here. |              |

Already good: pure, side-effect-free predicate functions with a narrowed `ReviewSession = Pick<UserSession, ...>` type, trivially unit-testable without constructing a full session; `isEditablePeriod`'s 3-line comment is correctly budgeted and states a genuine non-obvious WHY.

## review.module.ts — clean

## review.prisma-repository.ts — clean

## review.service.ts (3 findings)

| Lines | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Suggestion                                                                                                                                                                                                                                                                      | Your verdict |
| ----- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 71-81 | env-config | medium   | Logger config reads `process.env.LOG_DIR`/`process.env.LOG_LEVEL` ad hoc at class-field-init time (not via a schema/`requireEnv`), casts `LOG_LEVEL` with `as` instead of validating it, and silently falls back to `?? "info"` — the fallback pattern the ENV/CONFIG rule forbids for product config. The identical 12-line block is copy-pasted in `weekly-report.service.ts`, `report-sections.service.ts`, and `search.service.ts` (4 occurrences). | Extract a single `createServiceLogger(serviceName: string)` helper that reads LOG_DIR/LOG_LEVEL once via a validated env schema (Zod, no `.default()`, fail loud on invalid LOG_LEVEL) and call it from every service constructor instead of re-reading `process.env` per file. |              |
| 34-40 | comments   | medium   | 7-line JSDoc on `DashboardScopeSession` opens with a ticket/phase reference ("UFB-040 / Phase 46-02") and narrates implementation detail well past the 3-line budget — exact change-log/ticket archaeology the comment-hygiene policy forbids.                                                                                                                                                                                                          | Strip the ticket/phase prefix; if the group-scope-visibility rationale is load-bearing, relocate it to the group-scope openspec spec/ADR and leave a <=2-line pointer here.                                                                                                     |              |
| 9-32  | placement  | low      | `ReviewAccessError`/`ReviewNotFoundError`/`ReviewConstraintError` are defined in `review.service.ts` (dashboard-read only), but all three are actually thrown in `review-actions.service.ts` (record acknowledgement, a different sub-domain). `review.service.ts` itself never throws any of them.                                                                                                                                                     | Move the three error classes to a shared `review-errors.ts` in the same module, imported by both files, so the file that owns the errors is a file that uses them.                                                                                                              |              |

Already good: `sortRows` is pure and immutable (`[...rows].sort(...)`, no in-place mutation), and the service re-validates with `.array().parse(...)` after sorting rather than trusting the repository — consistent belt-and-suspenders validation matching the repository side.

## Rollup

**By dimension:** comments 6, parameters 3, env-config 1, placement 1.

**By severity:** medium 5, low 6.

**Top-3 highest impact:**

1. `acknowledge(userId, reportId, groupId)` positional-string-param transposition risk, duplicated across `review-actions.service.ts` and `review-actions.prisma-repository.ts` — a swapped arg silently acknowledges the wrong report/group with no type-level guard.
2. Ad hoc, unvalidated `LOG_DIR`/`LOG_LEVEL` env reads with a silent `?? "info"` fallback in `review.service.ts`, copy-pasted verbatim into 3 other services — a product-config fallback the repo's ENV rule explicitly forbids, and a 4x duplication.
3. `isDesignatedReviewer(session, groupId, canReviewFlag: boolean)` boolean-flag + 3-positional-param authorization predicate in `review-authz.ts` — the highest-consequence file in the module to leave ambiguous at the call site.

**Overlaps with a PENDING openspec change — handle there, not in a style sweep:**

- Both `acknowledge()` param-shape findings (review-actions.service.ts, review-actions.prisma-repository.ts) and the `isDesignatedReviewer` boolean-flag finding (review-authz.ts) touch the acknowledgement write path → **review-acknowledgement**.
- The `applyRevokeTransition` reuse comment (review-actions.prisma-repository.ts:206-209) documents an optimistic-lock/atomicity guarantee on record writes → **add-section-optimistic-lock**.
- The env-config logger duplication (review.service.ts:71-81) is a cross-service observability/config concern, not scoped to this module → **observability-and-perf-hardening**.
- The misplaced error classes (review.service.ts:9-32) are exactly a domain-error-mapping concern → **map-domain-errors**.
- All 6 comment-budget-overrun findings (12-18, 27-33 in review-authz.ts; 89-94 in review-actions.service.ts; 206-209 in review-actions.prisma-repository.ts; 34-40 in review.service.ts) are the same systemic issue → **tighten-comment-policy**.
- The `scopeCoversGroup`/`groupScopeFilter` drift-risk rationale (review-authz.ts:12-18) is a group-scope authorization concern → **scope-period-lifecycle-authz**.

## Killed by verification

None — all reported findings verified against the current source and kept.
