## 1. API — service (pass all sections)

- [ ] 1.1 Widen `CarryOverRepository.saveCarryOver` in `carry-over.service.ts` to
      accept all target sections (e.g. `targetSections: ReportSectionReadModel[]`)
      instead of a single `targetSection`.
- [ ] 1.2 Update `CarryOverService.executeCarryOver` to pass the full
      `nextTargetSections` array (drop the `.at(0)` single-section selection), keeping
      the empty-sections guard.
- [ ] 1.3 Decide the `CarryOverResult` shape (keep `targetSection` as first
      section for back-compat, or widen to `targetSections`) and update the interface.
- [ ] 1.4 Restrict the counted/recorded carried set to source sections that have
      a matching target section (by `authorId`), so `carriedItemCount` /
      `carriedDecisionCount` and the emitted `CarryOverRecord` rows never exceed the
      rows persisted across target sections (no dangling `targetItemId` /
      `targetDecisionId`).

## 2. API — repository (persistence fidelity)

- [ ] 2.1 In `carry-over.prisma-repository.ts`, loop the item and decision upserts
      over every target section inside the existing `$transaction`.
- [ ] 2.2 Replace the decision write `stageName: d.stageIds?.join(", ")` with
      `stageNames: d.stageIds ?? []`; remove every reference to the non-existent
      scalar `stageName`.
- [ ] 2.3 Add `priorityRank: i.priorityRank ?? null` and
      `stageNames: i.stageIds ?? []` to the carried `Item.createMany` payload.
- [ ] 2.4 Wrap the execution insert to catch
      `Prisma.PrismaClientKnownRequestError` `code === "P2002"` on `dedupeKey`; on
      conflict re-read the existing execution and return it idempotently, or (only if
      it cannot be re-read) throw a distinct `CarryOverConflictError` — never reuse
      `CarryOverDomainError`, and never write a `failed` status.
- [ ] 2.5 Ensure `mapPrismaToExecution` counts and the returned result stay
      consistent with the rows actually written across all sections.

## 3. API — error mapping

- [ ] 3.1 If 2.4 surfaces a conflict, add a distinct `CarryOverConflictError` (do
      NOT reuse `CarryOverDomainError`, which is mapped class-wide to `BAD_REQUEST`
      and shared by the validation errors) and add a dedicated `trpc.error-mapper.ts`
      branch mapping only `CarryOverConflictError` to CONFLICT without leaking
      internal messages, leaving the existing `CarryOverDomainError` → BAD_REQUEST
      branch unchanged.

## 4. Tests

- [ ] 4.1 Add an integration case: source section with an unresolved decision
      (with product + `stageIds`) carries over without aborting, and the target
      `Decision` has matching `stageNames`.
- [ ] 4.2 Add an integration case: a next-week item with `priorityRank` and
      `stageIds` carries `priorityRank` and `stageNames` to the target `Item`.
- [ ] 4.3 Add an integration case: a multi-section (multi-lead) report persists
      carried rows for every section, and persisted counts equal the execution's
      `carriedItemCount` / `carriedDecisionCount`.
- [ ] 4.4 Add a case for the dedupe P2002 race (two executions for the same
      source/target) asserting no unhandled error and the documented resolution.
- [ ] 4.5 Update `carry-over.service.test.ts` / `carry-over.contract.test.ts`
      doubles for the widened `saveCarryOver` signature.
- [ ] 4.6 Add a case: a source lead with no matching target section does not
      inflate `carriedItemCount` / `carriedDecisionCount` and emits no dangling
      `CarryOverRecord` (every persisted record resolves to a written row).
- [ ] 4.7 Add cases for the write-integrity guard: carry-over into a published
      target report, into an archived target report, and into an editable report
      with a submitted target section are each rejected and persist no rows.

## 5. API — write-integrity guard

- [ ] 5.1 In `carry-over.service.ts`, guard `executeCarryOver` before any write:
      reject with `CarryOverDomainError` when the target report's period is not
      editable — `periodStatus` not in `{open, reopened}` OR `Report.archived` is
      true (treat published and archived as closed), mirroring the canonical
      `computeReopenEligibility` rule and the `fillFrom` / `saveDraft` published
      guards.
- [ ] 5.2 Add a `CarryOverRepository` read for the target report's `periodStatus`
      and `archived` flag (the section `status` is already on the
      `ReportSectionReadModel` from `getTargetSections`); implement it in
      `carry-over.prisma-repository.ts`.
- [ ] 5.3 Reject the execution when any matched target `ReportSection` has status
      `submitted` (read-only); abort the whole execution (single `$transaction`),
      do not skip the section.

## 6. Verification

- [ ] 6.1 Run `pnpm typecheck` and fix any errors.
- [ ] 6.2 Run `pnpm lint` and fix any warnings/errors.
- [ ] 6.3 Run `pnpm test` (including the carry-over integration suite against the
      `_test` database) and confirm green.
- [ ] 6.4 Run `pnpm build` and confirm it succeeds.
- [ ] 6.5 Run `openspec validate "fix-carryover-persistence" --strict` and
      confirm it exits 0.
