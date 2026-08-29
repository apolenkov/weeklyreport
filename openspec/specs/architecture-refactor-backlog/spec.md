# architecture-refactor-backlog Specification

## Purpose

Record the status and closure of architecture refactor targets across lead-form decomposition, shared domain vocabularies, repository boundaries, and dead-surface removal.

## Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record that the live composition root is
`apps/web/src/features/report-pages/ui/lead/shell/lead-form.tsx` (250 LOC after
`refactor-lead-form-toolbar-chrome` on 2026-07-10; the 250-line value was the
decomposition target, not the repository-wide `max-lines` threshold). The
historical slices below originated under the former `report-sections` feature
path and are retained as a record; each was captured as its own grilled
refactor change before work started. The first slice
is `refactor-lead-mappers`: the pure cross-author and snapshot derivations
moved to tested adapters now owned by `apps/web/src/features/report-sections/model/` (landed at 1658 LOC on
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
- **THEN** the backlog names the live `report-pages/ui/lead-form.tsx` composition
  root and the 250-line decomposition target
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
`apps/web/src/shared/lib/auth/role-predicates.ts` (`isHead` / `isAdmin` / `isLead` /
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
and guard parity tests. The five follow-ups it named are now all closed:
(i) role-label drift and (iii) schema-derived membership checks were closed
by `unify-role-label-presentation` (2026-07-11); (ii) the api auth bridge
seams, (iv) dev-email value centralization, and (v) catalog role-token
validation plus stale landing prose were closed by
`finish-role-vocabulary-followups`.

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
  records all five follow-ups as closed by `unify-role-label-presentation`
  and `finish-role-vocabulary-followups`

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
`add-status-ssot-lint-gate` (the `status-type-ssot-gate` spec). The
presentation vocabulary's triple declaration is ALSO CLOSED — consolidated
by `unify-canonical-status-type` behind `CanonicalStatus`
(`status-presentation-model` spec). The remaining named follow-up stays open
as a separate future change: deduplicating `TRAFFIC_RANK` / `statusSeverity`
ranking logic.

#### Scenario: the traffic-light SSOT is discoverable

- **WHEN** a maintainer searches for the traffic-light status contract
- **THEN** the backlog names `packages/shared` `report-primitives.schema.ts`
  as the single home, records the target as closed by
  `unify-traffic-light-status-type`, and links the
  `traffic-light-status-type` spec
- **AND** it records the lint gate and the presentation-vocabulary
  consolidation as closed and names the one remaining deferred follow-up
  (ranking-logic dedup) as a future change

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
and infrastructure internals. The cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling is ALSO CLOSED — landed by `unify-report-section-prisma-payload`
(2026-07-11): the corrected inventory is ten production sites (not five —
two direct `report-sections.prisma-repository.ts` casts, two `carry-over`
casts, one `pdf-export` nested cast, three `lead-form` casts routed through
`Parameters<typeof mapPrismaToReportSection>[0]`, one
`published-report-snapshot.ts` cast behind its own underspecified hand
types, and one `weekly-report.prisma-repository.ts` `any[]` erasure), all
resolved by deriving `mapPrismaToReportSection`'s parameter from
`Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`
instead of a hand-written mirror (`report-section-prisma-payload` spec). The
investigation also surfaced and closed one reachable correctness bug the
casts had been hiding: `saveSection`'s post-save re-read cast a nullable
Prisma result straight into the mapper with no null guard, unlike every
other call site — a concurrent report deletion could crash it; the re-read
now happens inside the write transaction, closing the race structurally.
This requirement relates to `repository-scope-guard` only thematically —
that spec governs group-scope authorization, not types.

#### Scenario: the boundary closure is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog records the corrected inventory, names
  `unify-report-status-type` and the `report-status-type` spec, and records
  the target as closed
- **AND** it records the port-type invariant and lint gate as closed by
  `add-status-ssot-lint-gate`
- **AND** it records the infrastructure cast coupling as closed by
  `unify-report-section-prisma-payload`, names the corrected ten-site
  inventory and the `report-section-prisma-payload` spec, and notes the
  concurrent-deletion hardening found and fixed along the way

### Requirement: The 2026-07-12 dead-code inventory is a recorded, closed cleanup

The backlog MUST record that the dead and orphaned code surfaced by the
2026-07-12 repo-excellence review was removed by `remove-dead-code`: the
orphaned duplicate `apps/api/src/modules/reminders/reminders.router.ts`
(the scope-checked procedures inline in `trpc.router.ts` are the only
production reminder-execution surface), the two dead session validators in
`apps/web/src/shared/server/auth/session.ts`, the dead `isoWeekLabel` helper and its
two supporting constants in `apps/web/src/features/admin/model/admin.ts`, the
always-false `blocked` check in `section-slide-utils.ts`'s
`crossAuthorContentToSlideForeign` (the shared `itemWorkflowStatusSchema`
union excludes `"blocked"`, so the comparison could never be true), and the
PDF-export `checksum` value that the service threaded through
`markExportCompleted` while the real Prisma repository silently dropped it —
now persisted on `PdfExportJob.checksum`. It MUST also record that the
reminder-policy backfill script's `computeFireAt` no longer takes a dead
`_tz` parameter: it now uses the same luxon zone-aware math as
`PolicyApplicatorService.computeFireAt`, and both functions' doc comments
were corrected to describe the math accurately (exact-duration minutes added
to a zoned instant, not calendar wall-clock preservation), with the
class-level doc's stale claim that the backfill script calls `applyToPeriod`
removed. The two `computeFireAt` implementations MUST stay separate
functions, cross-referencing each other by file path, because the prisma
toolchain's isolated `tsconfig.prisma.json` cannot resolve `apps/api` or
`packages/shared` imports — the same constraint already carved out for
`prisma/seeds/support/seed-constants.ts`.

#### Scenario: the dead-code cleanup is discoverable

- **WHEN** a maintainer searches for known dead-code cleanups
- **THEN** the backlog names the six removed/fixed surfaces (reminders
  router, session validators, `isoWeekLabel`, the always-false `blocked`
  check, the PDF-export checksum gap, and the backfill `computeFireAt` dead
  parameter) and records them as closed by `remove-dead-code`
- **AND** it states why the two `computeFireAt` implementations remain
  separate rather than sharing one imported helper

#### Scenario: a future prisma-script change needs logic from apps/api or packages/shared

- **WHEN** an agent or maintainer considers importing workspace code into a
  `prisma/*.ts` script
- **THEN** the backlog's carve-out (first established for
  `prisma/seeds/support/seed-constants.ts`, reaffirmed here for `computeFireAt`) applies:
  the isolated `tsconfig.prisma.json` cannot resolve those imports, so the
  logic is kept as an intentionally cross-referenced literal mirror instead

### Requirement: Hand-duplicated types and constants are recorded centralization targets

The backlog MUST record that four small groups of hand-declared types and
constants — each independently re-declared instead of importing one shared
source — are centralized: the `{shortName, fullName}` organization-brand
shape (previously `OrganizationBrand` in two email templates and
`ReminderOrganization` / `ReminderOrganizationJob` in the reminders service
and its BullMQ processor, now the single shared `OrganizationBrand` type in
`packages/shared`), the analytics chart palette (`COLORS` plus
`ChartSeries` / `ChartData`, previously duplicated between the lead-velocity
and traffic-light-history charts, now `apps/web/src/features/analytics/ui/chart-palette.ts`),
the slide-record discriminators (`getActiveItemRecord`,
`getActiveRiskRecord`, `getActiveDecisionRecord`, previously duplicated
between `slide-inline-editor-dialogs.tsx` and `use-slide-inline-editor.tsx`,
now exported once from the dialogs file), and the dev-login role picker's
role list (previously two independent literal arrays in
`login-page.client.tsx`, now `sessionRoleSchema.options`). All four are
landed by `centralize-duplicated-types`. The TARGET IS CLOSED. Print-color
tokenization and any versions/snapshots residue are explicitly out of scope
for this target — the former is a ratified intentional exception, the latter
belongs to a dropped, unrevived feature area.

#### Scenario: a maintainer looks for the duplicated-type sweep

- **WHEN** a maintainer searches the backlog for hand-duplicated types or
  constants
- **THEN** the backlog names the four centralized sites (organization-brand
  type, chart palette, slide discriminators, dev-login role list), their
  shared source locations, and records the target as closed by
  `centralize-duplicated-types`

#### Scenario: a new duplicate of one of these shapes is introduced

- **WHEN** a maintainer adds a new email template, a new analytics chart, or
  a new slide-record consumer that needs the organization-brand shape, the
  chart palette, or the active-record discriminators
- **THEN** they import the shared source (`OrganizationBrand` from
  `@customreport/shared`, `COLORS`/`ChartSeries`/`ChartData` from
  `chart-palette.ts`, or the exported discriminators from
  `slide-inline-editor-dialogs.tsx`) instead of re-declaring it

### Requirement: Dead API surface identified by code review MUST be deleted, not documented as intentional

The backlog MUST record that a code-review sweep found nine dead-surface findings in `apps/api` — `shutdownOtel` (`otel.bootstrap.ts`), the `pdfExportRouter` module (`modules/pdf-export/pdf-export.router.ts`, superseded by `infrastructure/trpc/routers/pdf-export.router.ts`), `applyTransition`/`runTransition` (`period-transition.apply.ts`), `getReportStatus` on `ReportSectionsRepository` plus the doc comment on `report-sections.service.ts` that falsely claimed a `getReportStatus` fallback exists, `getLatestPublishedId` on `WeeklyReportRepository` (repo, service, and Prisma query), and the `leadHeadAdminProcedure` canonical builder in `trpc.middleware.ts` — each reachable only from its own unit test, never from production code. Every one of these is deleted by `remove-dead-surface-api`, and the `role-coverage-gate` spec's canonical-builder count is corrected from 9 to 8 in the same change.

#### Scenario: Every deleted symbol is confirmed caller-free before removal

- **WHEN** each symbol named above is grepped repo-wide prior to deletion
- **THEN** the only hits are its own declaration and its own test file (or, for `pdfExportRouter`, the one stale test importing it)
- **AND** no production module imports or calls it

#### Scenario: The report-sections doc comment matches real control flow

- **WHEN** `evaluateDeadlineGate` is inspected after this change
- **THEN** it returns `false` directly when `getReportMeta` is not implemented, with no call to a `getReportStatus`-shaped fallback
- **AND** the `getReportMeta` doc comment states that plain fact instead of describing a fallback that never runs

#### Scenario: The role-coverage gate's builder count stays accurate

- **WHEN** `openspec/specs/role-coverage-gate/spec.md` and its allow-list test are inspected after this change
- **THEN** both enumerate exactly 8 canonical builders
- **AND** neither references `leadHeadAdminProcedure`

### Requirement: Dead web-frontend surface found by code review MUST be deleted, not just tolerated

The backlog SHALL record that code review confirmed six pieces of
`apps/web` surface with no production caller, each carrying its own test
suite that gives false coverage confidence, and that these were deleted
rather than kept: `stageNameMatches`
(`features/report-sections/model/stage-tags.ts`),
`visibleLeadSlidePeriodOptions`
(`features/slides/model/lead-slide-periods.ts`), the
`applyStatusSuggestion`/`syncSource()` half of `useStatusRiskSync`
(`features/report-sections/model/status-risk/use-status-risk.ts`), the ignored `source?: SyncSource` parameter
contract on `handleStageStatusChange`, and `getDialogPreset`
(`shared/ui/dialogs/confirmation-dialog.tsx`).

#### Scenario: Reviewer re-encounters one of the removed symbols

- WHEN a future review or grep turns up `stageNameMatches`,
  `visibleLeadSlidePeriodOptions`, `applyStatusSuggestion`, `syncSource`, or
  `getDialogPreset` reintroduced in `apps/web`
- THEN treat it as new dead surface requiring the same justification (a real
  production caller) before it is allowed to stay, not as a restoration of
  prior-approved code

#### Scenario: A hook parameter is added to a public interface

- WHEN a function's exported interface declares an optional parameter (e.g.
  `source?: SyncSource`)
- THEN the implementation MUST branch on that parameter's value, or the
  parameter MUST be removed — an interface may not advertise behavior the
  implementation does not provide

### Requirement: Dead web-frontend surface found by the 2026-07-22 mass review MUST be deleted, not just tolerated

The backlog SHALL record that the 2026-07-22 mass review confirmed three
more pieces of `apps/web` surface with no production caller or effect, and
that these were deleted rather than kept: the `<Suspense
fallback={<NavBarSkeleton />}>` boundary in `app/(app)/layout.tsx` and
`NavBarSkeleton` itself (`shared/ui/navigation/nav-bar-skeleton.tsx`) — dead
because `NavBar` never suspends and already owns its own internal loading
skeleton; the `chrome?: "full" | "content"` prop on `LeadSlidesClient`
(`features/slides/ui/lead-slides-client.tsx`) — declared and passed by its
one caller but never read; and the `stagesWithoutRiskCoverage` field
computed by `computeCoupling` (`hooks/use-status-risk.ts`) — carried its own
dedicated test block but has no production reader.

#### Scenario: Reviewer re-encounters one of the removed symbols

- WHEN a future review or grep turns up `NavBarSkeleton`, a Suspense
  boundary wrapping `NavBar`, a `chrome` prop on `LeadSlidesClient`, or
  `stagesWithoutRiskCoverage` reintroduced in `apps/web`
- THEN treat it as new dead surface requiring the same justification (a real
  production caller/reader) before it is allowed to stay, not as a
  restoration of prior-approved code

#### Scenario: A component prop is added to a public interface

- WHEN a component's exported props interface declares an optional prop
  (e.g. `chrome?: "full" | "content"`)
- THEN the component's implementation MUST read and branch on that prop, or
  the prop MUST be removed — a props interface may not advertise behavior
  the implementation does not provide

#### Scenario: A Suspense boundary is added around a component

- WHEN a component is wrapped in `<Suspense fallback={...}>`
- THEN the wrapped component MUST actually suspend (throw a promise, e.g.
  via a suspense-enabled query) under some reachable condition, or the
  boundary and its fallback component MUST be removed — a Suspense
  fallback that can never render is dead surface, not a safety net
