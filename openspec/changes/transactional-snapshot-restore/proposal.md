## Why

An admin editing a single user, project, or reminder rule can silently lose
unrelated data. Each admin mutation reads the WHOLE org snapshot, changes one
entry in memory, and writes the whole snapshot back; the write runs as five
sequential `await`s with no transaction and reconciles destructively — any DB
row absent from the in-memory copy is deleted or archived. A transient error
mid-write leaves the org half-restored (users gone, projects untouched), and a
user created in the read-write window (e.g. a SAML JIT login) is reconciled away
even though no admin ever touched it. See backlog item BL-SNAPSHOT-RECONCILE
(P1) in `docs/repo-excellence-review-2026-06-28.md`.

## What Changes

- Wrap the snapshot write phases (groups → users → projects → periods →
  reminder rules) in a single interactive `prisma.$transaction`, so a
  mid-write failure rolls the whole restore back instead of leaving a partial
  state.
- Replace whole-snapshot destructive reconciliation with targeted mutations
  keyed by entity id: an edit upserts only the touched row; a removal deletes
  or archives only the named row. Rows the admin never referenced are no longer
  reconciled away. This closes the concurrent-insert data-loss window.
- Re-express the four caller services (`SnapshotAdminService`,
  `ProjectAdminService`, `ReminderAdminService`, `PeriodAdminService`) so
  user/project/rule/period add-edit-remove no longer round-trips through "read
  whole → mutate one → save whole", and extend the `AdminRepository` contract
  with entity-level persistence methods. `PeriodAdminService.upsertPeriod` is
  included: it currently does `getSnapshot → saveSnapshot`, so even after the
  destructive reconcile is removed it would re-write stale copies of every
  unrelated collection (groups, users, projects, reminder rules) from the T0
  read.
- **BREAKING (internal contract):** the `AdminRepository.saveSnapshot`
  full-snapshot reconcile semantics change; the in-memory test repository and
  affected `admin.service.test.ts` cases that encode destructive reconcile as
  intended behavior are re-expressed against targeted mutations.
- Settle the retained `saveSnapshot` removal contract as **additive-only**: a
  whole-snapshot restore upserts the supplied rows and never deletes or archives
  a row merely for being absent from the payload. No current caller needs
  delete-within-supplied-set, so the simpler additive contract is chosen now
  (not deferred to implementation) and covered by scenarios.

### Non-goals

- No change to PolicyApplicator timing — it stays post-commit (a failing
  applicator must not roll back newly-created periods).
- No new DB constraints, schema columns, or migrations.
- No change to `getSnapshot` read shape or the admin UI surface.

## Capabilities

### New Capabilities

- `admin-snapshot-persistence`: how admin org-snapshot mutations persist —
  transactional atomicity of the multi-entity write, and targeted (non-
  destructive) entity-level upsert/delete instead of whole-snapshot reconcile.

### Modified Capabilities

<!-- None: no existing capability governs admin snapshot persistence. -->

## Impact

- Code: `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`,
  `snapshot-admin.service.ts`, `project-admin.service.ts`,
  `reminder-admin.service.ts`, `period-admin.service.ts`,
  `admin.prisma-repository.ts`, the `AdminRepository` interface in
  `admin-shared.ts`, and the in-memory test repository.
- Tests: `admin.service.test.ts`, `admin.integration.test.ts`,
  `admin.contract.test.ts`.
- No API wire shape, schema, dependency, or deployment change.
