## 1. Characterization tests first (HOT-ZONE)

- [ ] 1.1 Add a real-DB integration test through the SERVICE layer
      (`saveDraft`), not the repository: two saves that both carry the SAME
      client-loaded `version`, assert the second is rejected with a conflict.
      Going through `saveDraft` proves the expected version comes from the
      client payload, not from the fresh `getActiveSection` fetch (a repo-only
      test would go green even if the service forwards the wrong version). This
      test starts RED against target behavior.
- [ ] 1.2 Add a test that a client-supplied child id colliding cross-section
      currently raises an unhandled error (documents the `P2002 → 500` gap).

## 2. Shared schema (packages/shared)

- [ ] 2.1 Add `version: z.number().int().min(1)` to
      `reportSectionReadModelSchema` in
      `packages/shared/src/schemas/section.schema.ts`.
- [ ] 2.2 Add `version` to `draftSaveSchema` (inherited by
      `submitSectionSchema`) so the client sends the expected version.
- [ ] 2.3 Update fixtures/factories that build `ReportSectionReadModel` or draft
      payloads to carry `version`; run `report.test.ts` / schema tests green.

## 3. Prisma model + migration (prisma)

- [ ] 3.1 Add `version Int @default(1)` to `ReportSection` in
      `prisma/schema.prisma`; remove the `TODO(v8.5-A-occ)` comment.
- [ ] 3.2 Hand-sync the `version` column into the single init migration SQL.
- [ ] 3.3 `prisma migrate reset` the `_dev` and `_test` databases (MVP; pass the
      Prisma AI-consent env var) and `prisma generate`.

## 4. API — conflict error + mapper

- [ ] 4.1 Add `SectionVersionConflictError` (extends `Error`) in the
      report-sections module.
- [ ] 4.2 Add a branch in
      `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` mapping it to
      `TRPCError({ code: "CONFLICT" })`.
- [ ] 4.3 Add a mapper unit test asserting the new error → `CONFLICT` and that
      `P2002` from a child create → `BAD_REQUEST`.

## 5. API — repository compare-and-set

- [ ] 5.1 In `saveSection`, replace the unconditional `reportSection.update`
      with `updateMany where { id, version: expected }` incrementing `version`;
      throw `SectionVersionConflictError` when `count === 0`, before any
      `deleteMany`.
- [ ] 5.2 Remove the `...(i.id ? { id } : {})` / risk / decision id spreads so
      the database mints child ids; catch `P2002` and rethrow as the
      domain error that maps to `BAD_REQUEST`.
- [ ] 5.3 Provenance is out of scope: the read model carries no child
      `createdAt`, so leave the delete-then-recreate provenance behavior as-is
      and record the follow-up to add `createdAt` to the read + input schemas and
      persist it on recreate (deferred, see proposal/design Non-Goals).
- [ ] 5.4 Apply the same compare-and-set + server-minted ids to
      `fillFromSection` in `lead-form.prisma-repository.ts`.

## 6. API — service wiring

- [ ] 6.1 Forward the payload's `version` as the expected value into
      `saveSection` from `saveDraft` and `submitSection` in
      `report-sections.service.ts`; return the read model with the bumped
      version.
- [ ] 6.2 Add a `version` field to the Fill-From tRPC input and to the
      `fillFromSection(targetSectionId, sourceSectionId)` signature (it has none
      today), then forward the target's expected version through the Fill-From
      service path — without this the Fill-From 409 scenario is unreachable.

## 7. Web — send version, recover on 409

- [ ] 7.1 Send the loaded `version` from the lead form save path
      (draft autosave + manual save + submit).
- [ ] 7.2 On a genuine cross-writer `CONFLICT`, do not present success; refetch
      the section so the next save carries the current version.
- [ ] 7.3 Centralise same-client save triggering in `useLeadFormAutosave`
      (`apps/web/src/hooks/use-lead-form-autosave.ts`) so BOTH the debounce timer
      (lines 163–184) and `forceSave` (lines 206–236) funnel through one
      in-flight queue: when `saveDraftMut.isPending`, stash the payload instead of
      firing a second `saveDraft`. Then make `onSuccess(data)` consume the bumped
      `version` from the mutation result and rebase the queued payload's `version`
      onto it BEFORE firing the queued save, so the same-client continuation
      neither self-conflicts on the stale loaded version nor loses the queued
      local edits via a refetch.
- [ ] 7.4 Add tests for edit-while-save-in-flight covering BOTH triggers — a
      debounced edit AND a `forceSave` issued while a save is in flight: each
      queued payload fires with the bumped version, succeeds without a 409,
      preserves the queued local edits, and no second `saveDraft` is fired
      concurrently while the first is in flight.

## 8. Verify

- [ ] 8.1 Re-run the characterization tests from group 1 — they now pass
      (lost update prevented, conflict surfaces as 409).
- [ ] 8.2 Run the gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 8.3 Run `openspec validate add-section-optimistic-lock --strict`.
