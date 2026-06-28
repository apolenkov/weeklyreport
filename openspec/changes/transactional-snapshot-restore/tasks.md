## 1. Repository contract (shared seam)

- [ ] 1.1 Extend the `AdminRepository` interface in `admin-shared.ts` with
      entity-level persistence methods: `upsertUser`, `removeUser`,
      `upsertProject`, `removeProject` (archive), `upsertReminderRule`,
      `removeReminderRule` — each keyed by id and returning the canonical row or
      `void`.
- [ ] 1.2 Decide and document the whole-snapshot `saveSnapshot` removal
      contract (additive-only vs. delete-within-supplied-set, per design Open
      Questions) and reflect the chosen contract in the interface doc comment.

## 2. API write path — atomicity

- [ ] 2.1 In `admin-snapshot-write.queries.ts`, wrap the five phases of
      `saveSnapshot` (`upsertGroups` → `upsertUsers` → `upsertProjects` →
      `upsertPeriods` → `upsertReminderRules`) in a single
      `prisma.$transaction(async (tx) => …)`.
- [ ] 2.2 Widen each `upsert*` helper's first parameter from `PrismaService`
      to the Prisma transaction-client type so they run under `tx` (follow the
      `lead-form.prisma-repository.ts` pattern).
- [ ] 2.3 Keep `PolicyApplicatorService.applyToPeriod` strictly AFTER the
      transaction returns; assert by structure that the applicator loop is outside
      the `$transaction` callback.
- [ ] 2.4 Preserve the `resolveLifecycle` non-transition period write inside
      the transaction (no derivation of coupled lifecycle fields from one field).

## 3. API write path — targeted mutations

- [ ] 3.1 Implement targeted `upsertUser` / `removeUser` in the prisma write
      queries (upsert by id; delete by id with the existing FK-reference guard and
      `P2003` skip). Do not delete users absent from any whole snapshot.
- [ ] 3.2 Implement targeted `upsertProject` / `removeProject` (upsert by id;
      archive by id). Do not archive projects merely for snapshot absence.
- [ ] 3.3 Implement targeted `upsertReminderRule` / `removeReminderRule`
      (upsert by id; delete by id). Do not delete rules merely for snapshot
      absence.
- [ ] 3.4 Remove the whole-snapshot destructive reconcile branches
      (`removedUserIds`, `removedProjectIds`, `removedRuleIds`) from the per-phase
      helpers; route removals only through the explicit methods.
- [ ] 3.5 Wire the new methods through `admin.prisma-repository.ts` to the
      write-queries module.

## 4. API caller services

- [ ] 4.1 Rewrite `SnapshotAdminService.upsertUser` / `removeUser` to call the
      targeted repository methods instead of `getSnapshot → mutate → saveSnapshot`.
- [ ] 4.2 Rewrite `ProjectAdminService.upsertProject` / `removeProject` to call
      the targeted repository methods.
- [ ] 4.3 Rewrite `ReminderAdminService.upsertReminderRule` /
      `removeReminderRule` to call the targeted repository methods.
- [ ] 4.4 Confirm each service still returns the response shape its tRPC
      procedure expects (re-read the affected row, or return the updated snapshot
      if the procedure contract requires it).

## 5. Test repository + tests

- [ ] 5.1 Add the new entity-level methods to the in-memory test repository so
      contract tests exercise the same surface as the prisma repository.
- [ ] 5.2 Audit `admin.service.test.ts` for cases that assert the destructive
      reconcile (an absent row gets deleted/archived) and re-express them against
      the targeted mutations — do not weaken or delete coverage.
- [ ] 5.3 Add a test proving partial-restore rollback: a `saveSnapshot` whose
      later phase throws leaves the DB unchanged (integration test on a `_test`
      DB).
- [ ] 5.4 Add a test proving the concurrent-insert window is closed: a row
      inserted between read and write survives an unrelated targeted edit.
- [ ] 5.5 Add tests for explicit removal (user delete honors the FK guard;
      project archive touches only the named row; rule delete touches only the
      named row).
- [ ] 5.6 Update `admin.integration.test.ts` / `admin.contract.test.ts` for the
      new repository contract.

## 6. Validation

- [ ] 6.1 Run `pnpm typecheck` (transaction-client typing must pass).
- [ ] 6.2 Run `pnpm lint`.
- [ ] 6.3 Run `pnpm test` (admin unit + integration + contract suites green).
- [ ] 6.4 Run `pnpm build`.
- [ ] 6.5 Run `openspec validate "transactional-snapshot-restore" --strict`.
