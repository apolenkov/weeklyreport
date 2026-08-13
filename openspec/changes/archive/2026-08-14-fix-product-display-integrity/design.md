## Context

See `proposal.md` for motivation. The live database proves that Olga and Sergey belong to `Finance Platforms`, while all 15 seeded `GroupProduct` rows belong to `Software Development`. The edit form reads author-owned report data, but Section Preview reads the group-scoped weekly report, so the same populated draft appears empty. The weekly-report response already carries `groupId` per live section, but not a human-readable group name.

## Goals / Non-Goals

**Goals:**

- Make effective seed user groups and explicit product groups one consistent dataset.
- Carry a validated group label to the existing per-group acknowledgement presentation.
- Keep every report item reachable when current product assignments no longer contain the item's product.
- Prove the repaired paths at the seed, read-model, component, and representative browser levels.

**Non-Goals:**

- Change group authorization, review permissions, report lifecycle semantics, or published snapshots.
- Convert the screenshot atlas into an exhaustive frozen gate.
- Add a migration or preserve disposable MVP rows.

## Decisions

### Use one effective-group resolver during seed composition

Before:

```text
SEED_USERS.reportingGroupId -> GroupProduct
profile reassignment        -> User.reportingGroupId
```

After:

```text
effectiveGroupForSeedUser -> User.reportingGroupId
                          -> GroupProduct.groupId
                          -> profile validation
```

The seed will derive both writes from one pure resolver. This is preferred to patching Finance products afterward because later profile changes cannot silently recreate the split.

### Resolve group names in the weekly-report live read

The weekly-report repository will batch-resolve the distinct live section group ids to names and stamp `groupName` beside `groupId` on the live section read model. The web `ReviewModel` will deduplicate `{groupId, label}` pairs and pass the label to the existing acknowledgement component. Published snapshots remain unchanged because review actions are disabled for published reports.

Alternatives rejected:

- A raw UUID suffix is stable but not meaningful to a user.
- Lead names are available but identify people, not the acknowledgement's group target.
- Loading the admin group list from the browser duplicates scope and adds a second request path.

### Keep display evidence finite and product-first

The acceptance set is the repaired desktop state plus representative iPhone and Pixel layouts for the affected report surfaces. Existing mobile geometry tests remain the deterministic gate. The archive holds human-reviewed screenshots; the repository does not acquire a second visual-test framework.

### Append deterministic orphan-product columns

The report badge counts the complete item collection. The board must therefore
render that same collection. When a stored item references a product absent
from the lead's current assignment list, append one column per missing product
after the current assigned-product columns. Preserve first-seen product order
and the item's stored product label. This mirrors the existing activity-lane
rule that keeps orphan rows reachable and avoids silently changing historical
report data merely because current assignments changed.

Alternatives rejected:

- Dropping the row makes the visible badge disagree with the rendered records.
- Reassigning the row to a current product changes report meaning.
- Hiding the mismatch behind a generic unassigned column loses the stored
  product identity and combines unrelated products.

## Risks / Trade-offs

- [Shared read-model field reaches non-weekly consumers] -> make the field optional at the generic section boundary, require and test it in the live weekly-report builder, and preserve existing write responses.
- [A group is deleted or unnamed] -> fail the live weekly-report parse/build path rather than render an unlabeled acknowledgement action.
- [Seed reset destroys local MVP rows] -> target only the allowlisted `customreport_e2e` database through the existing destructive guard and explicit consent.
- [Full-page screenshots exaggerate sticky-overlay behavior] -> verify modal containment at the viewport and with existing mobile geometry assertions, not from full-page pixels alone.
- [Historical product rows add columns to a compact board] -> append only products that own rows, retain local vertical scrolling, and verify every counted card is reachable at desktop and mobile widths.

## Migration Plan

No schema migration is needed. Reset and reseed only `customreport_e2e`, run seed validation and focused tests, then recapture the affected desktop/mobile surfaces. Rollback is a source revert plus another guarded disposable reset.

The period dual-state invariant, canonical role-coverage middleware, destructive database guard, and deferred-feature pattern remain unchanged.
