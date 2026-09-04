## Context

See `proposal.md` and `research.md`. Overview already mounts the canonical lead
editor and can edit existing Current/Next items. Its presentation flattens all
units into one list, truncates the unit name beside its status, and renders
`No updates` without an authoring action. The pinned SitePing popup is rendered
outside the application tree and positions a materially taller form using a
hard-coded 220 px estimate.

## Goals / Non-Goals

**Goals:**

- make Product and Activity groups immediately scannable;
- preserve complete reporting-unit identity at accepted desktop widths;
- start a correctly seeded Current/Next item from any editable matrix cell;
- retain one dialog, `DraftPatch`, autosave, version, ACL, and lifecycle path;
- make SitePing's explicit Send action visible for the owner-reported tall
  selection without querying private widget DOM from application code.

**Non-Goals:**

- no second Overview form model or write endpoint;
- no batch editing or creation in historical/read-only content;
- no host stylesheet or selector coupled to SitePing internals;
- no unrelated visual redesign.

## Decisions

### Represent creation as an explicit reporting-unit target

Overview receives a `source`, `unitKind`, and `unitId` when an Add action is
activated. A transient create-dialog state opens the existing `ItemEditDialog`
with either `defaultProductId` or `defaultActivityId`. Save appends the returned
item to the matching canonical week array through the existing `week-items`
`DraftPatch`. This mirrors the established quick-add merge without extending
its first-product-only seed contract or adding another persisted store.

### Keep Add contextual and secondary

Every editable Current/Next cell exposes one `Add update` action after its
previews. Empty editable cells replace the passive dead end with that action;
read-only cells retain `No updates`. Previously planned never receives a create
target. Accessible names include unit and week so repeated compact labels remain
unambiguous.

### Group by type and preserve full identity

The existing Product-first, Activity-second ordering becomes two labelled
groups with counts. The repeated per-row type eyebrow is removed from active
groups, while historical state remains explicit. Unit names wrap instead of
using single-line truncation; status and ownership metadata occupy a separate
wrapping row so they do not steal identity width.

### Repair SitePing at the dependency boundary

The upstream popup owns its DOM and positioning, so WeeklyReport must not move
it after render. A pnpm patch to the exact pinned `@siteping/widget` version
changes the package's own placement calculation to display the popup with
bounded dimensions, measure the actual rendered box, and clamp that box to the
viewport. Both ESM and CommonJS entrypoints used by the package contract stay
equivalent. A compatibility test protects the patch until an upstream release
contains the same behavior.

## Invariants

- Period dual-state and report lifecycle are untouched.
- Add and Edit use the canonical editor's one draft/autosave/write path.
- Product creation seeds a Product; Activity creation seeds an Activity and no
  Product stage.
- Previously planned and every read-only section remain inert.
- SitePing ownership, screenshot, diagnostics, and authenticated ingress stay
  unchanged.

## Risks / Trade-offs

- [Too many repeated Add actions] -> use one quiet action per editable cell and
  detailed accessible names rather than full-size primary buttons.
- [Stale dialog after report navigation] -> bind dialog state to the current
  editor generation and reject a save when its target no longer belongs to the
  active model.
- [Dependency patch drifts] -> pin the exact version, patch both runtime module
  formats, assert the measured-placement signature, and remove the patch when a
  verified upstream release supersedes it.
- [Wrapped names increase row height] -> limit the metadata stack, preserve
  thin separators, and browser-test both accepted desktop viewports.

## Migration Plan

No data migration exists. Rollback removes the Overview creation callbacks and
the exact SitePing patched-dependency entry. Existing report and feedback rows
remain valid.
