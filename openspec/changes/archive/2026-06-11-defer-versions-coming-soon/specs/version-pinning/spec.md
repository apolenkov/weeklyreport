# version-pinning (delta)

## REMOVED Requirements

### Requirement: A lead can pin and unpin a version of their own section

**Reason**: User decision 2026-06-11 — version history/snapshots are removed entirely (DB + backend + UI); there is no snapshot to pin. The `leadForm.setVersionPinned` mutation is deleted. Supersedes `add-version-pin` (archived 2026-06-11). Future versioning starts from the `versions-v2-restore-fidelity` research draft.

### Requirement: Pinned versions are exempt from retention pruning

**Reason**: The retention sweep itself is deleted together with the `VersionSnapshot` table; the exemption has nothing to exempt.

### Requirement: Snapshot kind is a closed enum with a writer per value

**Reason**: The `VersionSnapshotKind` Prisma enum and the `versionSnapshotSchema` Zod mirror are deleted with the model; `enum-state-hygiene` is satisfied by the enum no longer existing.

### Requirement: Pinned versions are marked and surfaced first in the history

**Reason**: The version history surface (`VersionHistoryNav`, history modal, pin star) is deleted; the toolbar slot carries an inert `ComingSoonBadge` control per `deferred-feature-pattern`.
