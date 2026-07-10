# architecture-refactor-backlog Specification

## Purpose

TBD - created by archiving change backlog-architecture-refactors. Update Purpose after archive.

## Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record that
`apps/web/src/features/report-sections/ui/lead-form.tsx` (250 LOC after
`refactor-lead-form-toolbar-chrome` on 2026-07-10; 250-line `max-lines`
standard) is a decomposition target being reduced in recorded slices, each
captured as its own grilled refactor change before work starts. The first slice
is `refactor-lead-mappers`: the pure cross-author and snapshot derivations
moved to tested adapters in `apps/web/src/lib/mappers/` (landed at 1658 LOC on
2026-06-11; the file stood at 1930 when the slice started). The second slice is
`refactor-lead-form-draft-orchestration`: the draft mirror, stable draft payload
baseline, autosave handoff, stale-version conflict handler, and optimistic-lock
version owner moved behind a tested feature-local hook (landed with the file at
2036 LOC; it stood at 2117 when the slice started). The third slice is
`refactor-lead-form-write-actions`: submit/revoke/reopen/fill-from command
orchestration, dialog/error state, write invalidation, and optimistic-lock
command-time version reads moved behind a tested feature-local hook (landed
with the file at 1858 LOC; it stood at 2036 when the slice started). The fourth
slice is `refactor-lead-form-draft-merges`: product/activity/item/risk/decision
presentation-to-draft merge commands, item move commands, blocker routing, and
quick-add item saves moved behind a tested feature-local boundary (landed with
the file at 1485 LOC; it stood at 1858 when the slice started). The fifth slice
is `refactor-lead-form-loaded-view-model`: loaded display derivations for
cross-author products, own/foreign rows, activity cards, unified entries,
published-lineage locks, visible periods, and read-only affordances moved behind
a tested feature-local boundary (landed with the file at 1314 LOC; it stood at
1485 when the slice started). The sixth slice is
`refactor-lead-form-data-loading`: the six lead-form queries, enablement
chains, record-visibility gating, foreign-content cache purges,
canonical/head-away redirects, and query error handlers moved behind a tested
feature-local hook, with the file-local SVG icons and record-visibility toggle
relocated to their own modules (landed with the file at 986 LOC; it stood at
1314 when the slice started). The seventh slice is
`refactor-lead-form-edit-sections`: the edit-mode section stack — review
feedback, the sync-bridge Provider with the Product Status, Activities, item,
and Risks accordions, and the Decisions accordion — moved into presentational
`LeadFormEditSections` / `LeadFormItemSections` components consuming the
loaded view model and draft-merge handlers as whole objects (landed with the
file at 698 LOC; it stood at 986 when the slice started). The eighth slice is
`refactor-lead-form-dialogs-and-header`: the page header with its
document-action group and the dialog cluster (submit confirmation, quick-add
item host, request-reopen, revoke confirmation) moved into presentational
`LeadFormHeaderActions` / `LeadFormDialogs` components consuming the loaded
view model, draft-merge handlers, and write actions as whole objects (landed
with the file at 443 LOC; it stood at 698 when the slice started). The ninth
slice is `refactor-lead-form-toolbar-chrome`: the toolbar context controls
(period navigator, archive filter, record-visibility and view-mode toggles,
collapse-all/fullscreen slot) moved into a presentational
`LeadFormToolbarControls` component, the document-title and archive
auto-expand chrome effects moved behind a feature-local `useLeadFormChrome`
hook, and the `lead-form.tsx` ESLint exemptions were removed (landed with the
file at 250 LOC; it stood at 443 when the slice started). With the file at
the 250-line standard, the SIZE target of this decomposition is CLOSED; the
slice list stays as history. The composition root remains subject to the
repo-wide lint gates with no exemptions; the deferred `ReportDataCoordinator` /
`FormStateManager` objects MUST NOT be built outside a future grilled change
of their own.

#### Scenario: the lead-form size target is discoverable

- **WHEN** a maintainer looks for known oversized modules
- **THEN** the backlog names `lead-form.tsx` with its current LOC and the 250
  target
- **AND** it lists the landed slices (first: `refactor-lead-mappers`; second:
  `refactor-lead-form-draft-orchestration`; third:
  `refactor-lead-form-write-actions`; fourth:
  `refactor-lead-form-draft-merges`; fifth:
  `refactor-lead-form-loaded-view-model`; sixth:
  `refactor-lead-form-data-loading`; seventh:
  `refactor-lead-form-edit-sections`; eighth:
  `refactor-lead-form-dialogs-and-header`; ninth:
  `refactor-lead-form-toolbar-chrome`) and records the size target as closed
  at the standard

#### Scenario: a later slice starts

- **WHEN** an agent or maintainer picks up further lead-form decomposition work
- **THEN** a grilled OpenSpec change exists for that slice before any code is
  written
- **AND** the change cites the updated LOC evidence from the previous slice

### Requirement: The client permission model is a recorded centralization target

The backlog MUST record that web-client permission/authorization logic is
scattered across components rather than centralized, and SHOULD be consolidated
into a single client-side permission source. This is recorded as a deferred
design target.

#### Scenario: the permission-model target is discoverable

- **WHEN** a maintainer reviews client authorization
- **THEN** the backlog names the scattered-permission concern and its
  centralization target
- **AND** it is marked as needing its own grilled change before work starts

### Requirement: The traffic-light value is a recorded single-source-of-truth target

The backlog MUST record that the traffic-light (green/amber/red) / risk value is
re-typed across ~33 files instead of a single shared enum, and SHOULD be
unified into one source-of-truth in `packages/shared` schemas, consistent with
`schema-conventions`. This is recorded as a deferred target.

#### Scenario: the traffic-light SSOT target is discoverable

- **WHEN** a maintainer searches for duplicated domain enums
- **THEN** the backlog names the traffic-light re-typing with its ~33-file spread
  and the `packages/shared` SSOT target
- **AND** it links the work to `schema-conventions`

### Requirement: The repository Prisma-type leak is a recorded boundary target

The backlog MUST record that API repositories leak raw Prisma row types across
the domain boundary instead of mapping to shared/domain contracts, and SHOULD be
changed so repositories return domain types. This relates to the existing
`repository-scope-guard` spec and is recorded as a deferred target.

#### Scenario: the Prisma-leak target is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog names the Prisma-type leak and the domain-mapping target
- **AND** it links the work to `repository-scope-guard`
