## 1. Characterization tests first (api)

- [ ] 1.1 Add a real-DB test that two concurrent `PeriodService.publishPeriod`
      calls on one open period transition the row once (assert one snapshot, one
      set of counter increments); it should FAIL before the fix.
- [ ] 1.2 Add the equivalent concurrent test for `review.publish` →
      `PublicationService.publishReport`.
- [ ] 1.3 Add a test that `review.publish` / `review.assembledReport` act on
      the DB-resolved open/reopened period, not a stale `ctx.session.activeReportId`
      (seed an older activeReportId, a newer open period); FAIL before the fix.
- [ ] 1.4 Add a `review.publish` characterization/contract test that a
      DB-resolved reopened period (`periodStatus = "reopened"`, legacy
      `status = "published"`) is republishable and emits the transition counter
      with `from: "reopened", to: "published"`; it should FAIL before the fix
      (today the publication read model exposes only legacy `status`, the
      `status === "published"` fast-path rejects, and the counter hardcodes
      `from: "open"`).

## 2. Compare-and-set in the period publish path (api)

- [ ] 2.1 Change `period.prisma-repository.ts::publishPeriod` to use
      `tx.report.updateMany({ where: { id, periodStatus: { not: "published" } }, data: buildTransition("publish", …) })`
      and capture `{ count }`.
- [ ] 2.2 When `count === 0`, return a no-op result without rebuilding the
      snapshot; when `count === 1`, read the row via `findUniqueOrThrow` with
      `reportFullIncludeForSnapshot` and write the snapshot in the same
      transaction. Return the transitioned flag/count to the service.
- [ ] 2.3 In `period.service.ts::publishPeriod`, emit both counters and run the
      ingestion enqueue only when the repository reported a transition
      (`count === 1`); keep the prior-status `from` label.

## 3. Compare-and-set in the publication path (api)

- [ ] 3.1 Make the `PublicationService.publishReport` write conditional on a
      `periodStatus != "published"` row (NOT legacy `status`, so a reopened period
      stays publishable) and report both whether it transitioned and the row's
      prior `periodStatus`. Change the fast-path rejection to test
      `periodStatus === "published"`. Surface `periodStatus` through the
      publication repository/read model — the assembled-report read model exposes
      only legacy `status` today — so the service has the prior status for the
      counter `from` label.
- [ ] 3.2 Gate the snapshot rebuild, ingestion enqueue, and both counter
      increments on `count === 1`; on a zero-transition result return the
      already-published assembled report or a domain "already published" error
      (one consistent choice across both paths — resolve the design Open Question).

## 4. Database-resolved publish target (api)

- [ ] 4.1 In `trpc.router.ts`, resolve `review.publish` and
      `review.assembledReport` through the shared `getCurrentEditableId` resolver
      (newest non-archived open/reopened period, `periodStart <= now`, ordered by
      `periodStart` desc then `id` desc), replacing `ctx.session.activeReportId`.
      Move `review.dashboard` off its looser inline query onto the same resolver
      so all three pick the identical period.
- [ ] 4.2 When the resolver returns nothing, raise a domain "no active period"
      error mapped to a tRPC error for `review.publish` / `review.assembledReport`
      and remove the now-dead `activeReportId` null-check branches; keep
      `review.dashboard`'s existing empty-result response for that state.
- [ ] 4.3 Add a test that the resolved publish target excludes an archived
      open/reopened row and breaks a shared-`periodStart` tie deterministically by
      `id` desc, so `review.dashboard`, `review.assembledReport`, and
      `review.publish` resolve the same period.

## 5. Keep the dual-state invariant machine-checked (api)

- [ ] 5.1 Confirm the `period-dual-state` CI gate recognizes the new
      `report.updateMany` lifecycle write (extend the matcher to cover
      `updateMany`, or add the reviewed per-site marker); the publish `data` still
      comes from `buildTransition`.

## 6. Telemetry-contract tests (api)

- [ ] 6.1 Assert a redundant concurrent publish increments each counter
      exactly once (covers the `manual-publish-telemetry` MODIFIED requirement)
      for both `period.publish` and `review.publish`.
- [ ] 6.2 Assert the transition counter's `from` label carries the actual prior
      `periodStatus` (`"open"` vs `"reopened"`) for both `period.publish` and
      `review.publish`, never a hardcoded `from: "open"`.
- [ ] 6.3 Re-run the characterization tests from group 1 and confirm they now
      pass.

## 7. Verification

- [ ] 7.1 Run `pnpm typecheck`.
- [ ] 7.2 Run `pnpm lint`.
- [ ] 7.3 Run `pnpm test`.
- [ ] 7.4 Run `pnpm build`.
- [ ] 7.5 Run `openspec validate "make-publish-atomic" --strict` and confirm it
      exits 0.
