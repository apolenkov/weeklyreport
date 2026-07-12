## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

The publication write path freezes an immutable `publishedSnapshot` that was
assembled from a report read taken at an EARLIER, separate round-trip. Both
`PublicationService.publishReport` and `PublicationService.publishAuto` call
`getAssembledReport` first, then hand that in-memory `AssembledReport` down to
`PublicationPrismaRepository.publishAssembledReport` /
`saveAutoPublishedReport`, which write `toPublishedSnapshotJson(report)` into the
guarded `updateMany`. The write itself is a single statement, but its snapshot
BYTES reflect the state at the earlier read. A lead section-save that commits
between the assemble-read and the compare-and-set write is excluded from the
permanently-frozen snapshot forever — and the auto-publisher runs this exact
path at the deadline, the highest-probability moment for a concurrent lead edit.
The frozen snapshot is the read surface the viewer is served
(`weekly-report.prisma-repository.ts`), so the loss is permanent and visible.

The sibling `PeriodPrismaRepository.publishPeriod` is already safe: it runs the
compare-and-set inside a `$transaction`, re-reads the row through that same `tx`,
and builds the snapshot from the written-back row — so its snapshot always
reflects the latest committed state. The publication path never adopted that
strategy.

Two adjacent defects on the same file ride along:

- `PublicationPrismaRepository.saveAssembledReport` writes only the lifecycle
  scalars (`buildTransition("open", {})`) and then re-reads the unchanged row,
  silently discarding every section edit its only caller
  (`PublicationService.updateSectionForReview`) computed. This is latent — no
  tRPC router procedure wires `updateSectionForReview`; its sole callers are its
  own unit and contract tests — so the discard never reaches production, but the
  dead write-path is a live trap for the next caller.
- The post-publish ingestion seam is documented "fire-and-forget" three times
  (the `IngestionPublishHook` doc comment, `publishReport`, and `publishAuto`)
  yet the enqueue is `await`ed with its errors swallowed. The comment, not the
  code, is wrong.

## What Changes

- `apps/api/src/modules/publication/infrastructure/publication.prisma-repository.ts`
  — rewrite `publishAssembledReport` to mirror `PeriodPrismaRepository.publishPeriod`
  exactly: run the shared `publishCompareAndSet` helper inside a `$transaction`
  via the `tx` client (so its zero-row disambiguation re-read is transactional),
  then re-read the row through that same `tx` and write the `publishedSnapshot`
  built from that fresh in-transaction read as a second statement inside the
  transaction. The lifecycle field set continues to come from the transition
  builder and is passed to the helper's `data`; the snapshot is NO LONGER carried
  inside the helper's `updateMany` `data`. The returned `AssembledReport` is
  built from the same in-transaction re-read, so the frozen snapshot and the
  returned report can never disagree.
- Same file — apply the identical transactional shape to `saveAutoPublishedReport`.
  Its compare-and-set predicate stays `status: "draft"` / `archived: false`
  (unchanged) and it continues NOT to call the manual-publish helper; only the
  snapshot's freshness and atomicity change (in-transaction re-read + second-
  statement snapshot write).
- Delete the dead `saveAssembledReport` port method and its implementation, and
  delete `PublicationService.updateSectionForReview` (its only caller, itself
  unreachable from the tRPC router). `getAssembledReport` — which HAS a live
  router caller — is untouched. Their unit/contract test coverage is removed with
  them.
- `apps/api/src/modules/publication/application/publication.service.ts` — correct
  the three "fire-and-forget" comments (the `IngestionPublishHook` doc comment,
  and the enqueue comments in `publishReport` and `publishAuto`) to say the
  enqueue is awaited and its errors are swallowed. No behavior change to the
  enqueue itself — the awaited-and-swallowed semantics are intentional.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `publish-compare-and-set`: records that BOTH publish repositories now build the
  immutable snapshot from a fresh in-transaction re-read (never from an earlier
  separate round-trip), and that `publishAssembledReport` now runs inside a
  `$transaction` like `publishPeriod` — replacing the prior "single-statement
  execution is its only atomicity" strategy for the publication path.

## Impact

- `apps/api/src/modules/publication/infrastructure/publication.prisma-repository.ts`
- `apps/api/src/modules/publication/application/publication.service.ts`
- `apps/api/src/modules/publication/application/{publication.service.test.ts,publication.contract.test.ts}`
  (updateSectionForReview / saveAssembledReport coverage removed)
- `apps/api/src/modules/publication/infrastructure/publication.integration.test.ts`
  (extend to prove snapshot freshness under a concurrent section-save)

Non-goals:

- Not a versions/snapshots revival — that feature was dropped. This hardens the
  EXISTING `publishedSnapshot` assembly only.
- The `saveAssembledReport` / `updateSectionForReview` pair is DELETED, not wired
  to persist the section aggregate. Reviving a review-time section-edit write
  path is a separate, unrequested change.
- The ingestion enqueue stays awaited-and-swallowed; it is NOT truly detached
  (detaching would change error-handling semantics — unhandled rejection and
  test timing — for no gain). This is comment hygiene only.
- `PeriodPrismaRepository.publishPeriod` is already correct and is not modified.
