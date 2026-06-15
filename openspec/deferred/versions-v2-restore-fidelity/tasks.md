# Tasks — versions-v2-restore-fidelity (DRAFT — not started)

> This change is a research capture. None of these tasks are
> authorized to start until the user explicitly reopens versions v2.

## 1. Design ratification

- [x] 1.1 Ratified in `design.md`: Option A + restore-creates-a-version
      (restore = `saveSection(snapshot read model)`, atomic full replace,
      throttle-exempt pre-restore safety snapshot).
- [x] 1.2 Decided in `design.md`: BOTH — in-payload envelope
      `{ schemaVersion, data }` is the discriminated-union parse source
      of truth; a denormalized `schemaVersion Int` column aids
      retention/migration queries. Unknown/no-migration version → refuse,
      never merge.
- [x] 1.3 Decided in `design.md`: pinning OUT of scope (user has not
      re-asked); no `pinned` kind, no pin control.
- [x] 1.4 Inventory captured in `design.md` from the LIVE read model.
      Load-bearing: the read model has no separate `projectStatuses` /
      `stageStatuses` arrays — they fold into `projects[].trafficLight`
      and `projects[].ownedStages[].status`. Grown since draft: `late`,
      `referencedProjects`, `authorRole`, `priorityRank`.

## 2. Shared contracts

- [ ] 2.1 Add `SNAPSHOT_SCHEMA_VERSION` named const and the strict
      snapshot payload Zod schema to `packages/shared`.
- [ ] 2.2 Add the type-level drift guard: snapshot shape `satisfies` a
      key-complete mapping of the section read model's renderable
      fields, so a new renderable field breaks `pnpm typecheck`.
- [ ] 2.3 Define the migration registry contract (schemaVersion N → N+1
      total functions; restore refuses payloads with no migration
      path).

## 3. Schema + backend

- [ ] 3.1 Re-add `VersionSnapshot` to `prisma/schema.prisma`; hand-sync
      the init migration; `migrate reset` `_dev` AND `_test` (consent
      var per MVP DB rule; never prod).
- [ ] 3.2 Re-derive snapshot trigger/throttle/dedup/retention from git
      history (`git show 7d8ace5d~1` of `snapshot.service.ts` /
      `lead-form.prisma-repository.ts`) — semantics unchanged.
- [ ] 3.3 Implement capture from the shared render projection (no
      parallel serializer).
- [ ] 3.4 Implement restore: strict parse by `schemaVersion`, atomic
      full wipe+replace of items/risks/decisions/projectStatuses/
      stageStatuses, pre-restore safety snapshot, new-version-on-restore.
- [ ] 3.5 Enforce lock gates: snapshot/restore only on own draft
      section in an open period; version viewing allowed when locked.
- [ ] 3.6 Re-add tRPC procedures at the `TODO(versions-v2)` marker
      (`trpc.router.ts:~1972`) using canonical builders
      (role-coverage gate).

## 4. Web

- [ ] 4.1 Replace `VersionComingSoonControl` with the real version
      history nav (English UI strings only).
- [ ] 4.2 Re-wire the autosave success path marker in `lead-form.tsx`
      (`TODO(versions-v2)` at ~line 594) to snapshot creation.
- [ ] 4.3 Read-only version overlay + restore confirmation flow.

## 5. Verification (the gating contract)

- [ ] 5.1 Round-trip integration test: for a section exercising EVERY
      renderable field, `map(restore(snapshot(S))) === map(S)` deep
      equality.
- [ ] 5.2 Negative test: payload with unknown/older `schemaVersion` and
      no migration path → restore refused, current state untouched.
- [ ] 5.3 Migration-path test: registered N→N+1 migration restores with
      full fidelity (seeded with a synthetic old payload).
- [ ] 5.4 Lock tests: restore rejected on submitted section and
      non-open period; period-dual-state untouched (no Report writes).
- [ ] 5.5 Drift guard proven: temporarily add a renderable field in a
      type test and assert typecheck/test failure mode works.
- [ ] 5.6 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Remaining work (deferred 2026-06-15, NOT done) — supervised finish required

The DESIGN is Codex-approved (3 rounds). The BACKEND CORE is implemented,
reviewed (2 Opus lenses), and the fidelity safety net is real + proven:
contract 4/4 + page-fold 2/2; CAS / schema-refusal / lifecycle-pinning / both
fold branches confirmed sound; the drift guard now trips a compile error on a
new owned read-model field. The methods are UNREACHABLE (no tRPC, no web).

Before this is a usable, safe feature, a supervised session must:

- [ ] R1 [MAJOR] Server-side lock gate: `restoreVersion` takes no `userId` and
      enforces no own/draft/open-period check. Add `userId`; enforce in the
      service (mirror `fillFrom`). BLOCKING before wiring. (race lens RACE-1)
- [ ] R2 [MAJOR] Version-number race: snapshot create does read-max+1 with no
      transaction → unhandled P2002 under concurrency. Wrap in a tx with a lock,
      or catch P2002 + retry. (race lens RACE-2)
- [ ] R3 [MINOR] Pre-restore safety snapshot orphans on a CAS abort (commits
      before the guarded write). CAS-check first, or document as harmless.
- [ ] R4 [MINOR] `restoreVersion` returns a misleading `newVersion`
      (version+1 of the restored-from, not the true max). Query max(version).
- [ ] R5 [MINOR] `restoreSectionContent` CAS wrapper is duplicated in two repos.
      Consolidate to one (writeOwnedChildRows is already shared).
- [ ] R6 [MINOR/LATENT] writeOwnedChildRows drops decisions with null productId;
      snapshot schema permits null. Aligns only because DB productId is NOT NULL.
- [ ] R7 tRPC procedures at the TODO(versions-v2) marker (trpc.router.ts:1986):
      list / getVersion (read-only overlay) / restoreVersion. Apply R1's gate.
- [ ] R8 Web: replace VersionComingSoonControl with the real history-nav UI;
      on restore enter a hard autosave-paused state + quiesce() (await in-flight
      AND queued saves) before issuing restore; pass the captured updatedAt for
      the CAS; remove the stale client snapshot trigger (lead-form.tsx:593).
- [ ] R9 Wire the autosave-snapshot trigger into the server saveDraft flow.
- [ ] R10 Live-walk the lead report page through capture -> restore in the
      browser (the fold claim is grounded in source, not yet empirically walked).
