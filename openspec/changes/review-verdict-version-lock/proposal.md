## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

A reviewer's verdict is recorded as current against a `ReportSection.version`
the reviewer never saw. `ReviewActionsService.verdict`
(`apps/api/src/modules/review/application/review-actions.service.ts:177-190`)
stamps `judgedVersion` from the freshly re-read server `context.version`, not
from the client-supplied `input.version` (the version the reviewer actually
judged). The optimistic `expectedVersion` lock is applied only inside the
`changes_requested` un-submit path
(`apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts:206-221`
via `applyRevokeTransition`) — never on an `approved` verdict, and never on the
`SectionReview` row write itself.

So if a lead re-submits in the ordinary latency window between the reviewer
opening the report and clicking Approve — bumping `version` N → N+1 while the
status returns to `submitted` — the approval is stamped `judgedVersion = N+1`.
The section read model then computes `isCurrent = true`
(`report-sections.prisma-repository.ts:320`,
`review.judgedVersion === sectionVersion`), so the head sees "approved,
current" for content the reviewer never reviewed. This is reachable through
normal UI latency, not a microsecond race.

The verdict feeds the advisory `isCurrent` badge in the section read model
(publish is not gated on approvals), so the blast radius is a misleading
head-facing review signal in a concurrency window — not corrupted or
unpublishable data — which is why this is P1 rather than P0.

## What Changes

- `ReviewActionsService.verdict` records `judgedVersion` from
  `input.version` (the version the reviewer judged) instead of the re-read
  `context.version`.
- The optimistic `version` lock is enforced on the verdict write for BOTH
  verdict values (`approved` and `changes_requested`), not only the
  `changes_requested` un-submit branch. When the reviewer-supplied
  `input.version` no longer matches the section's current version, the verdict
  is rejected as a concurrency conflict and NO `SectionReview` row is written.
- The version check is enforced atomically inside the verdict write
  transaction (`ReviewPrismaRepository.postVerdict`), so a lead re-submit that
  commits between the service's context read and the verdict write cannot slip
  a stale-version verdict through. The `changes_requested` un-submit continues
  to reuse `applyRevokeTransition`'s `status = "submitted"` guard for its own
  atomicity.
- A new `ReviewVersionConflictError` domain error is added to
  `review.service.ts` and mapped to `CONFLICT` (409) in
  `trpc.error-mapper.ts`, mirroring the existing `SectionVersionConflictError`
  on the section-write path so the client can reload the current version and
  re-decide.
- A test pins the re-submit-during-window interleaving: a verdict posted with
  a `version` that no longer matches the section's current version is rejected,
  no `SectionReview` row is written, and the head-facing `isCurrent` signal is
  never stamped stale — for both `approved` and `changes_requested`.

## Capabilities

### New Capabilities

- `review-verdict-integrity`: a reviewer's verdict records the version the
  reviewer actually judged and is guarded by an optimistic version lock for
  every verdict value.

### Modified Capabilities

(none)

## Impact

- `apps/api/src/modules/review/application/review-actions.service.ts`
- `apps/api/src/modules/review/application/review.service.ts` (new error class)
- `apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts`
- `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`
- Review-actions test suite (`apps/api/src/modules/review/**`)

Non-goals: no change to the `applyRevokeTransition` write itself or its
`status = "submitted"` guard; no change to the section read-model `isCurrent`
derivation (`report-sections.prisma-repository.ts:320`); no change to the
`review.schema.ts` input/output shapes (the `version` field already carries the
reviewer-judged version); publish remains ungated on approvals.
