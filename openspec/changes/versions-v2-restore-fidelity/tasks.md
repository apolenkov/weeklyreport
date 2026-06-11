# Tasks — versions-v2-restore-fidelity (DRAFT — not started)

> This change is a research capture. None of these tasks are
> authorized to start until the user explicitly reopens versions v2.

## 1. Design ratification

- [ ] 1.1 Grill the recommendation (Option A + restore-creates-a-version)
      with the user; record decisions in `design.md`.
- [ ] 1.2 Decide `schemaVersion` placement: dedicated column vs
      in-payload field (proposal leans in-payload + Zod discriminated
      parsing; column helps retention/migration queries).
- [ ] 1.3 Decide whether pinning (`add-version-pin` semantics) returns
      in v2 or stays out of scope.
- [ ] 1.4 Confirm the renderable-field inventory against the LIVE read
      model at implementation time (it may have grown since this
      draft): items, risks, decisions, projectStatuses, stageStatuses,
      section meta.

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
