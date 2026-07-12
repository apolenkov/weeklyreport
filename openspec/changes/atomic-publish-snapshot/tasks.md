## 1. Make the manual publish snapshot atomic and fresh

- [ ] 1.1 `publication.prisma-repository.ts`: rewrite `publishAssembledReport` to
      mirror `PeriodPrismaRepository.publishPeriod` exactly. Wrap the work in
      `this.prisma.$transaction(async (tx) => { ... })`. Inside the transaction,
      call `publishCompareAndSet(tx, reportId, this.publishLifecycle(report, false))`
      — the helper's zero-row disambiguation re-read now runs through `tx`.
- [ ] 1.2 Remove `publishedSnapshot: toPublishedSnapshotJson(report)` from the
      helper `data`. After a `transitioned` outcome, re-read the row through the
      SAME `tx` with `reportFullIncludeForSnapshot`, build the assembled report
      from that fresh in-transaction row, and write `publishedSnapshot` as a
      SECOND `tx.report.update` statement inside the transaction (exactly as
      `publishPeriod` does).
- [ ] 1.3 Build the returned `AssembledReport` from that same in-transaction
      re-read (not a post-transaction `readAssembled`), so the frozen snapshot
      and the returned report are the same bytes. Preserve the existing fast-path
      `before.periodStatus === "published"` short-circuit and the `raced` /
      `archived` outcome mapping unchanged.

## 2. Make the auto-publish snapshot atomic and fresh

- [ ] 2.1 `publication.prisma-repository.ts`: apply the same transactional shape
      to `saveAutoPublishedReport`. Keep its compare-and-set predicate
      `{ id, status: "draft", archived: false }` unchanged and keep it NOT calling
      the manual-publish helper — only wrap it in `$transaction`, run the guarded
      `updateMany` through `tx`, and on a non-zero count re-read through the same
      `tx` and write the snapshot from that fresh row as a second in-tx statement.
- [ ] 2.2 Build the returned `report` in `AutoPublishResult` from the same
      in-transaction re-read. A zero-row count still returns `{ published: false }`
      with no snapshot write.

## 3. Delete the dead review-time write path

- [ ] 3.1 Confirm no production/router caller before deleting: grep
      `apps/api/src` for `updateSectionForReview` and `saveAssembledReport` and
      verify their only references are within `publication.service.ts` /
      `publication.prisma-repository.ts` and their tests — no `trpc.router.ts`
      procedure wires either.
- [ ] 3.2 Delete `PublicationService.updateSectionForReview` and the
      `saveAssembledReport` method from the `PublicationRepository` port and from
      `PublicationPrismaRepository`. Leave `getAssembledReport` and its
      `readAssembled` helper in place (`getAssembledReport` has a live router
      caller).
- [ ] 3.3 Remove the now-orphaned `updateSectionForReview` /
      `saveAssembledReport` cases from `publication.service.test.ts` and
      `publication.contract.test.ts`.

## 4. Correct the fire-and-forget comments

- [ ] 4.1 `publication.service.ts`: reword the `IngestionPublishHook` doc comment
      and the enqueue comments in `publishReport` and `publishAuto` so they state
      the enqueue is awaited and its errors are swallowed (the publish still
      returns even when the hook is degraded). Do not detach the enqueue — the
      awaited-and-swallowed semantics are intentional and unchanged.

## 5. Spec delta

- [ ] 5.1 `publish-compare-and-set`: ADD a requirement that the immutable
      `publishedSnapshot` is built from a fresh in-transaction re-read for BOTH
      publish paths, never from an earlier separate round-trip.
- [ ] 5.2 `publish-compare-and-set`: MODIFY "Injected Client Preserves Each
      Caller's Context And Snapshot Strategy" — both callers now run the helper
      inside a `$transaction` and build the snapshot from an in-transaction
      re-read as a second statement; drop the "publication path has no surrounding
      transaction / single-statement is its only atomicity" claim.

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test` — all green
- [ ] 6.3 Extend `publication.integration.test.ts`: commit a lead section edit
      AFTER `getAssembledReport` returns but BEFORE the publish write, then assert
      the frozen `publishedSnapshot` contains the edit (fails on the pre-change
      non-transactional path, passes after)
- [ ] 6.4 `pnpm test:integration` (single-thread, docker up) — the
      publish-atomicity integration test and the new freshness test both pass
- [ ] 6.5 `openspec validate atomic-publish-snapshot --strict`
