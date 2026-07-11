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

The backlog MUST record that the web client's role-identity checks are
centralized behind the pure predicate module
`apps/web/src/lib/role-predicates.ts` (`isHead` / `isAdmin` / `isLead` /
`isViewer` / `isHeadLike`, all `false` for `null`), landed by
`centralize-client-role-predicates` on 2026-07-10 and pinned by the
`client-role-predicates` spec. The layer is UX affordance only — enforcement
remains the API role-coverage gate and the server route gates; no new guards
were added. The already-centralized surfaces (nav-links role table,
`RoleGate`, `IfRole`, `ROUTE_ROLE_MAP`, `ROLE_HOME_PATH`) stay as they were;
server-computed capability flags stay server-computed. The TARGET IS CLOSED.
The role VOCABULARY is likewise unified: `unify-role-type` (2026-07-11)
converted every full-union re-declaration — the dev role switcher's duplicate
`Role` list the backlog previously named, plus three more bare duplicate
exported type names (four declarations — `UserRole` was doubled) and the
remaining inline unions (12 declarations across 11 production files, 8 unit
fixtures) — to the shared per-axis types (`Role` session / `DbRole`
persistence, `role-type` spec), pinned by a `DbRole`↔Prisma identity test
and guard parity tests. Named follow-ups stay open as separate future
changes: (i) role-label drift (nav renders "Group Head" beside
`ROLE_LABEL.head` "Head"; users-tab duplicates option labels; RoleBadge
displays the raw token; dashboard widens roles to `string`); (ii) the api
auth bridge seams (`roles.guard.ts` validates session roles with the DB
schema; provisioning/dev-login internals type with Prisma `Role`);
(iii) deriving `isRole`/`VALID_ROLES` from `sessionRoleSchema.options`,
merged with the standing literal-union lint-gate follow-up; (iv) dev-email
value centralization (web map, api map, seed users); (v) catalog role-token
validation and stale landing prose.

#### Scenario: the permission-model centralization is discoverable

- **WHEN** a maintainer reviews client authorization
- **THEN** the backlog names `role-predicates.ts` as the single identity
  source, records the target as closed by
  `centralize-client-role-predicates`, and links the
  `client-role-predicates` spec
- **AND** it states that enforcement stays with the API role-coverage gate

#### Scenario: the role-vocabulary unification is discoverable

- **WHEN** a maintainer searches for the role type contract
- **THEN** the backlog names the two shared axis types and the `role-type`
  spec, records the vocabulary target as closed by `unify-role-type`, and
  names the five deferred follow-ups as future changes

### Requirement: The traffic-light value is a recorded single-source-of-truth target

The backlog MUST record that the traffic-light status value is unified behind
one source of truth: `trafficLightStatusSchema` and its inferred
`TrafficLightStatus` type in `packages/shared`
(`report-primitives.schema.ts`), landed by `unify-traffic-light-status-type`
on 2026-07-10, consistent with `schema-conventions` and pinned by the
`traffic-light-status-type` spec. The original "~33 files re-typing
(green/amber/red)" phrasing is corrected by the landed inventory: 18 source
files and 6 test files re-declared the `green/yellow/red` union ("amber"
occurs in the workspace only as Tailwind CSS classes, never as a status
value); all now import the shared type. The TARGET IS CLOSED. The lint
regression gate for literal-union re-declaration is ALSO CLOSED — landed by
`add-status-ssot-lint-gate` (the `status-type-ssot-gate` spec). Remaining
named follow-ups stay open as separate future changes: consolidating the
presentation vocabulary's triple declaration (owned by
`status-presentation-model`) and deduplicating `TRAFFIC_RANK` /
`statusSeverity` ranking logic.

#### Scenario: the traffic-light SSOT is discoverable

- **WHEN** a maintainer searches for the traffic-light status contract
- **THEN** the backlog names `packages/shared` `report-primitives.schema.ts`
  as the single home, records the target as closed by
  `unify-traffic-light-status-type`, and links the
  `traffic-light-status-type` spec
- **AND** it records the lint gate as closed by `add-status-ssot-lint-gate`
  and names the remaining deferred follow-ups (presentation-vocabulary
  consolidation, ranking-logic dedup) as future changes

### Requirement: The repository Prisma-type leak is a recorded boundary target

The backlog MUST record that the repository/domain type boundary was audited
and closed by `unify-report-status-type` on 2026-07-10: the boundary was
already near-universally clean (of ~16 prisma-repositories, five touch
`@prisma/client` and four keep it strictly internal behind read-model
mappers); the ONE port-interface leak — Prisma's `ReportStatus` in the admin
repository port — is fixed by the shared `ReportStatus` type
(`report-status-type` spec), together with the two inline
`"draft" | "published"` re-declarations (archive service filter, period
domain transition), all pinned by a Prisma-to-shared identity test and an
ESLint restricted-import entry on the port file. The TARGET IS CLOSED. The
general repository port-return-type invariant with its literal-union lint
regression gate is ALSO CLOSED — landed by `add-status-ssot-lint-gate` (the
`repository-port-type-boundary` and `status-type-ssot-gate` specs), worded to
exempt the sanctioned Prisma-typed transaction applicators in `application/`
and infrastructure internals. The remaining named follow-up stays open as a
separate future change: the cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling. This requirement relates to `repository-scope-guard` only
thematically — that spec governs group-scope authorization, not types.

#### Scenario: the boundary closure is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog records the corrected inventory, names
  `unify-report-status-type` and the `report-status-type` spec, and records
  the target as closed
- **AND** it records the port-type invariant and lint gate as closed by
  `add-status-ssot-lint-gate` and names the one remaining deferred follow-up
  (infrastructure cast coupling) as a future change
