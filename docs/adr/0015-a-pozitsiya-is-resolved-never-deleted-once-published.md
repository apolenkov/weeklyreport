# A позиция is resolved, never deleted once it has been published

**Status:** proposed (locked via the demo-feedback grill on 2026-07-01; not yet
implemented — refines `openspec/changes/unified-activity-entry`)

## Context

A _позиция_ (CONTEXT.md term; English/code term: _record_) is the unit of weekly
work a lead authors — a current-week item, a next-week item, a risk, or a decision.
Саша's rule: work that leadership relied on must not silently disappear; a created
позиция should be **resolved**, not deleted.

Two facts shape this:

- **Today there is no delete button, but `saveSection` deletes-and-recreates the
  whole section's rows on every save** (`report-sections.prisma-repository.ts`). So a
  lead can already make a позиция vanish with no trace simply by removing it from the
  form and saving. "Don't lose work" is therefore not "remove a button" — it needs a
  guard on the write path, and (as the Decision explains) a stable record identity the
  recreate-with-fresh-ids model does not provide today.
- **Mistakes are real** — a typo, a duplicate, the wrong product. If nothing can ever
  be removed, the report fills with garbage. So removal must be possible for genuine
  mistakes.

The discriminator is whether anyone outside the author has relied on the позиция.
**Submit** is a soft, reversible state (the head can reopen; a reviewer can request
changes — ADR 0009). **Publish** is the official freeze the viewer and the published
snapshot depend on. Publish, not submit, is the point of no return.

## Decision

- A позиция that has **never been in a published report** can be deleted — it is an
  uncommitted draft mistake.
- Once a позиция **has been part of a published report**, it can no longer be deleted —
  only **resolved** (marked done) or **carried forward**. This is the invariant; the
  mechanism is deliberately NOT "diff by row id against the snapshot" — `saveSection`
  recreates rows with fresh DB-minted ids, so no record id survives a save and there is
  nothing stable to match. Enforcing the lock requires first introducing a **stable
  record identity / lineage** (a durable key set at creation, preserved through the
  recreate and copied by carry-over), and locking by that **lineage root**, not the
  current period's row id. See `openspec/changes/unified-activity-entry/design.md`.
- A delete-locked позиция carries a **visible marker** that explains why ("in the
  published record — resolve or carry, you can't delete it"), so the rule is understood,
  not just enforced.
- **Resolution states:** only **done** closes a позиция. _in-progress_, _blocked_, and
  _planned-next_ keep it open; _deferred_ is consciously parked but still open. Open work
  must not vanish at the period boundary. (Carry-over today covers next-week items and
  unresolved decisions — **whether risks carry is an open decision**: extend carry-over to
  risks, or consciously re-raise risks rather than carry them. See `design.md`.)
- **Carry-over stays head-manual** (the `unified-activity-entry` decision — a one-click
  "Copy forward unfinished", not automatic). To honor "don't lose work" without reversing
  that, uncarried open work is **surfaced at the newly opened period** — where carry-over
  is available — so the head can carry or consciously close it. It is surfaced where the
  action lives, not as a warning at the prior period's publish (which may predate the next
  period existing). Nothing moves automatically; the head is just never allowed to lose
  open work silently.

## Consequences

- "Don't lose work" becomes a write-path guard plus surfacing uncarried open work at the
  newly opened period — never silent behavior.
- **Prerequisite, not free:** this depends on introducing a stable record identity that
  the codebase lacks today. That same identity is needed for C1 per-record comment anchors
  and the C2 move-in-place rule, so it is a shared foundation, not a cost of this change
  alone. Until it lands, the invariant is specified but not enforceable.
- The lock keys on the record's lineage root, so a carried clone of a published record
  stays locked (same позиция continuing) while a genuinely new record this period is
  deletable until itself published.
- Carry-over today covers only next-week items and unresolved decisions — risks do not
  carry. "An unresolved risk carries" requires extending carry-over to risks or
  consciously narrowing the rule to items + decisions (decided at implementation).
- Cost: a позиция created-and-published by mistake can only be resolved or carried, not
  deleted — the official record is treated as sacrosanct. Accepted.
- The trigger (published) could later be relaxed to submitted if leadership wants an
  earlier lock; published is chosen as the clear, low-friction default that does not
  punish a lead for an in-flight draft.
