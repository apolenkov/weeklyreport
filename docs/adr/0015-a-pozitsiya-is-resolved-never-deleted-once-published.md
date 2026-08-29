# A published item or decision is resolved, never deleted

**Status:** accepted and implemented for items and decisions (archived as
`openspec/changes/archive/2026-07-02-unified-activity-entry`; current lineage
contract: `openspec/specs/lead-form-loaded-view-model/spec.md`)

**Supersession:** the published-lineage lock remains current; the original
head-manual carry-over decision was later reversed by
`openspec/specs/carry-over-automation/spec.md`, which now owns automatic
carry-over behavior.

## Context

A _позиция_ (CONTEXT.md term; English/code term: _record_) in this implemented
lineage contract means a current-week item, a next-week item, or a decision.
Risks are re-raised each period and remain outside the published-lineage delete
lock. Саша's rule for the covered records is that work leadership relied on must
not silently disappear; it should be **resolved**, not deleted.

Two facts shape this:

- **`saveSection` deletes-and-recreates the whole section's rows on every save**
  (`report-sections.prisma-repository.ts`), so the write path preserves the logical
  `stableId` and rejects removal of published lineage rather than relying on volatile
  database row ids.
- **Mistakes are real** — a typo, a duplicate, the wrong product. If nothing can ever
  be removed, the report fills with garbage. So removal must be possible for genuine
  mistakes.

The discriminator is whether anyone outside the author has relied on the позиция.
**Submit** is a soft, reversible state (the head can reopen; a reviewer can request
changes — ADR 0009). **Publish** is the official freeze the viewer and the published
snapshot depend on. Publish, not submit, is the point of no return.

## Decision

- A covered item or decision that has **never been in a published report** can be deleted — it is an
  uncommitted draft mistake.
- Once a covered item or decision **has been part of a published report**, it can no longer be deleted —
  only **resolved** (marked done) or **carried forward**. This is the invariant; the
  mechanism is deliberately NOT "diff by row id against the snapshot" — `saveSection`
  recreates rows with fresh DB-minted ids, so no record id survives a save and there is
  nothing stable to match. The implemented lock therefore uses **stable record
  identity / lineage** (a durable key set at creation, preserved through the
  recreate and copied by carry-over), keyed by that **lineage root**, not the current
  period's row id. See
  `openspec/changes/archive/2026-07-02-unified-activity-entry/design.md`.
- A delete-locked item or decision carries a **visible marker** that explains why ("in the
  published record — resolve or carry, you can't delete it"), so the rule is understood,
  not just enforced.
- **Resolution states:** only `done` closes an item. `planned`, `in_progress`,
  `paused`, and `postponed` remain open. Automatic carry-over moves eligible
  unfinished next-week items and unresolved decisions. A postponed item remains
  open but is replanned manually; risks are consciously re-raised rather than carried.
- **Carry-over is automatic.** Establishing the new-period section invokes the
  idempotent, race-safe carry-over path. No head click or manual banner remains; the
  later automation contract supersedes the original head-manual decision.

## Consequences

- "Don't lose work" becomes a write-path guard plus automatic carry-over of eligible
  records. Postponed items and risks remain explicit manual replanning work.
- The implemented `stableId` lineage is shared by the published-record lock,
  per-record comment anchors, and carry-over identity.
- The lock keys on the record's lineage root, so a carried clone of a published item or decision
  stays locked (the same logical record continuing) while a genuinely new record this period is
  deletable until itself published.
- Carry-over covers eligible unfinished next-week items and unresolved decisions.
  Postponed items are replanned manually; risks do not carry and are consciously
  re-raised when still relevant.
- Cost: an item or decision created-and-published by mistake can only be resolved or carried, not
  deleted — the official record is treated as sacrosanct. Accepted.
- The trigger (published) could later be relaxed to submitted if leadership wants an
  earlier lock; published is chosen as the clear, low-friction default that does not
  punish a lead for an in-flight draft.
