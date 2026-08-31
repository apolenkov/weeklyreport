# activity-reporting-unit Specification

## Purpose

Define activity-parented report records, links, and derived status across the lead form, slide deck, head report, and admin activity configuration without changing linked-product health.

Current consumer map (all paths are repository-relative): lead-form status cards
live in `apps/web/src/features/period/ui/activity-status-section.tsx`, editable
activity records in
`apps/web/src/features/report-sections/ui/activity/unified-activity-section.tsx`,
slide grouping in `apps/web/src/features/slides/ui/slide-activity-pills.tsx`,
and the head report in
`apps/web/src/features/report-pages/ui/weekly/weekly-report-page.tsx`.
The API entry points are
`apps/api/src/infrastructure/trpc/routers/activity.router.ts`,
`apps/api/src/infrastructure/trpc/routers/project-activity.router.ts`, and
`apps/api/src/infrastructure/trpc/routers/weekly-report.router.ts`.

## Requirements

### Requirement: An activity carries the same reporting records as a product

A project activity MUST be able to own the same reporting records as a product —
current/next items, blockers, priorities, risks, and decisions — with one
difference: an activity carries NO SDLC stage. `Item`, `Risk`, and `Decision`
each reference EXACTLY ONE parent: a product (their existing product FK) or a
project activity (a new nullable `activityId`). A hand-written XOR CHECK
constraint (`(productFk IS NOT NULL) <> (activityId IS NOT NULL)`) MUST enforce
that exactly one parent is set on every row. Activity-parented records reuse the
existing positions machinery unchanged — `stableId` lineage, carry-over,
`RecordComment` anchors, `searchTsv`, and the `saveSection` delete-recreate.
Activity-parented records MUST live in the section read model's top-level
`items`/`risks`/`decisions` arrays discriminated by `activityId` (product FK
null), exactly as product-parented records live in those same arrays
discriminated by their product FK. The presentation mapper groups each activity's
records under that activity for rendering — the same mapper behaviour that groups
a product's records under the product; the shared read model itself stays flat.

#### Scenario: a lead adds a current-week item to an activity

- **GIVEN** a lead whose section is attached to an activity
- **WHEN** the lead adds a current-week item and scopes it to that activity
- **THEN** the item persists with `activityId` set, its product FK null, and an
  empty `stageNames`
- **AND** the section read model returns that item in the top-level `items` array
  with `activityId` set, and the presentation mapper groups it under the activity

#### Scenario: a record references exactly one parent

- **WHEN** a write attempts to persist an item/risk/decision with BOTH a product
  FK and an `activityId`, or with NEITHER
- **THEN** the XOR CHECK constraint rejects the row

#### Scenario: an activity record survives the section save recreate

- **GIVEN** an activity-parented item that already carries a `stableId`
- **WHEN** `saveSection` delete-recreates the section's child rows
- **THEN** the item keeps its `stableId` and its `activityId`, and its anchored
  `RecordComment` rows transfer to the recreated row

### Requirement: An activity links to zero or more products

An activity MUST link to zero or more products through a many-to-many join
(`ProjectActivityProduct`), replacing the single label-only
`ProjectActivity.projectId`. Each activity row/card on every surface MUST show
its linked product(s). The link is label-only metadata on the activity: a
product MAY back several activities, and an activity MAY have no linked product.

#### Scenario: an activity linked to two products shows both

- **GIVEN** an activity linked to two products via `ProjectActivityProduct`
- **WHEN** the activity row renders on the lead form, slides, or head report
- **THEN** both linked product names appear on the activity row

#### Scenario: an activity with no linked product still renders

- **GIVEN** an activity with zero `ProjectActivityProduct` rows
- **WHEN** the activity renders on any surface
- **THEN** it renders normally with no linked-product label and no error

#### Scenario: one product backs several activities

- **WHEN** the same product is linked to two different activities
- **THEN** both `ProjectActivityProduct` rows are permitted (the join is keyed by
  `(activityId, productId)`, not by product alone)

### Requirement: The record dialog lets the lead choose an activity or a product parent

The Item, Risk, and Blocker/Decision entry dialogs MUST let the lead pick a
project ACTIVITY, not only a product, as the record's parent. The parent picker
MUST offer the section author's products AND attached activities. When the
chosen parent is an activity, the dialog MUST hide the SDLC Stages selector and
MUST NOT apply the stage-required rule — an activity has no stage to pick. The
same parent-picker behaviour applies to items, risks, and blockers (a blocker is
an item with `workflowStatus=blocked`, entered through the same dialog).

#### Scenario: choosing an activity hides the stage selector

- **GIVEN** the Add Item dialog open with products and activities available
- **WHEN** the lead selects an activity as the parent
- **THEN** the SDLC Stages selector is not rendered
- **AND** the lead can save the item without selecting any stage

#### Scenario: the parent picker is shared by risks and blockers

- **WHEN** the lead opens the risk or blocker entry
- **THEN** the same parent picker is shown, offering products and activities

#### Scenario: switching from a product to an activity clears stage selection

- **GIVEN** the dialog open on a product with two owned stages, one stage checked
- **WHEN** the lead switches the parent to an activity
- **THEN** the stage selection is cleared and the stage selector is hidden
- **AND** switching back to a product re-shows the stage selector with no
  pre-selected stage

### Requirement: An activity's status is derived from its own risks and blockers

An activity's traffic-light status MUST be derived from the activity's OWN risks
and blockers, never from SDLC stages (it has none) and never from a linked
product. When the activity owns a blocked item its status MUST be floored to red
(blocked); when it owns an at-risk or blocked risk its status MUST be floored to
at least that severity (precedence: blocked > at-risk). The lead MUST NOT be able
to lower the pill below the floor manually; the surface MUST explain the floor
with a message telling the lead to remove the risk/blocker first.

A manual raise MUST NOT be the only record of an alarm: clicking At Risk or
Blocked without a sufficient covering risk (blocked requires a covering blocked
risk; at-risk accepts any covering risk) MUST NOT persist the status and MUST
instead open the risk entry in create mode with the activity preselected as the
parent and the clicked severity prefilled — the pill analogue of the stage-chip
raise interception. On-track remains directly settable whenever no floor holds
the pill up. The interactive pill MUST derive its alarm floor from the live
draft risks so a just-created activity risk floors the pill without a
save/refetch round-trip.

#### Scenario: a blocked item forces the activity red

- **GIVEN** an activity that owns one item with `workflowStatus=blocked`
- **WHEN** the lead tries to set the activity's pill to on-track (green)
- **THEN** the pill stays red and the manual change is refused with a
  remove-the-blocker-first message

#### Scenario: an at-risk risk floors the activity to at-risk

- **GIVEN** an activity that owns one risk of severity at-risk and no blocker
- **WHEN** the activity status renders
- **THEN** the pill shows at least at-risk (yellow) and cannot be manually
  lowered to on-track

#### Scenario: no risk or blocker leaves the manual on-track choice intact

- **GIVEN** an activity with no risks and no blockers
- **WHEN** the lead sets the pill to on-track
- **THEN** the on-track status is accepted and persisted

#### Scenario: an unbacked raise routes through activity-scoped risk creation

- **GIVEN** an activity with no covering risk or blocker
- **WHEN** the lead clicks the pill's At Risk (or Blocked) option
- **THEN** the status is not applied
- **AND** the risk entry opens in create mode with the activity preselected as
  the parent and the clicked severity prefilled

#### Scenario: cancelling the prefilled risk entry leaves the pill unchanged

- **GIVEN** the risk entry opened by an unbacked pill raise
- **WHEN** the lead cancels it
- **THEN** the pill keeps its previous status and no risk row is created

#### Scenario: a saved activity risk floors the pill immediately

- **GIVEN** the risk entry opened by an unbacked Blocked click on an activity
- **WHEN** the lead saves the risk
- **THEN** the activity's pill renders blocked (red) without a reload

### Requirement: Activities render on the lead form, slides, and head report like products

Activities MUST render on the lead form, the lead slides, and the head report
with the same records/risks/blockers presentation a product uses, minus the SDLC
stage lane. On the lead form the split mirrors products exactly: the Project
Activities section (`activity-status-section.tsx`) is a STATUS-ONLY surface —
each attached activity renders as a card carrying its name, linked product(s),
and the risk/blocker-floored traffic-light pills, and MUST NOT list or accept
record content. The activity's records (items, risks, decisions) MUST render and
be editable in the main record sections (Current Week / Next Week / Risks /
Decisions, and the unified by-state view when enabled), grouped under an
activity lane keyed by `activityId` and labeled with the activity name — the
same grouping treatment product records get, without a stage lane. On the lead
slides, `lead/lead-slides-deck-view.tsx` renders the current section-slide and
grid model projections, with `slide-activity-pills.tsx` grouping activities by
traffic-light status. On the head report
(`activity-status-strip.tsx`, `weekly-report-page.tsx`) each activity renders in
the report body like a product — its records and linked product(s) — instead of a
status-only strip. Every surface MUST show the activity's linked product(s).

#### Scenario: the lead form renders a status-only activity card

- **WHEN** a lead opens their report form for a section attached to an activity
- **THEN** the activity renders as a card showing its name, linked product(s),
  and its derived traffic-light status
- **AND** the card lists no record content and offers no record entry
- **AND** no SDLC stage pipeline is rendered for the activity

#### Scenario: activity records are edited in the main record sections

- **GIVEN** a section owning an activity-parented current-week item, a risk, and
  a decision
- **WHEN** the lead opens the report form
- **THEN** each record renders in its matching main section under a lane
  labeled with the activity's name
- **AND** the lead can edit and delete it there exactly like a product record

#### Scenario: an activity lane never collapses into a product group

- **GIVEN** an activity-parented item (`productId` empty, `activityId` set)
- **WHEN** the week sections build their grouped columns
- **THEN** the item appears under its activity's lane, not under any product
  and not silently dropped

#### Scenario: activity items occupy priority ranks

- **GIVEN** an activity-parented item holding priority rank 1
- **WHEN** the lead opens the rank picker on any other own item
- **THEN** rank 1 is presented as taken

#### Scenario: the unified by-state view includes activity records

- **GIVEN** the org's unified activity view flag is on and a section owns an
  activity-parented item
- **WHEN** the unified view renders
- **THEN** the activity-parented item appears in its state bucket alongside
  product items, and its alarm derivation stays isolated (Q1)

#### Scenario: the slides group the lead's activities by status

- **WHEN** the lead slides render for a section carrying activities
- **THEN** the activities appear on the slides grouped by traffic-light status

#### Scenario: the head report renders each activity like a product

- **WHEN** the head opens the assembled weekly report
- **THEN** each activity renders in the report body with its records and linked
  product(s), minus the stage lane

### Requirement: An activity's risks and blockers never change a linked product's health

An activity's risks and blockers MUST NOT change any LINKED product's health. The
`ProjectActivityProduct` link is label-only: an activity's risk/blocker floors
ONLY the activity's own status and MUST NOT alter a linked product's traffic
light, its `worstStatus`, or the product-level flagged-red escalation roll-up
(`buildEscalationsFromReadSections`). Product health continues to derive solely
from product-parented records.

#### Scenario: a blocked activity leaves a linked product on-track

- **GIVEN** an activity linked to a product, the activity owning a blocked item,
  the product owning no blocker of its own
- **WHEN** both render
- **THEN** the activity's pill is red and the linked product's status stays
  on-track

#### Scenario: activity risks do not inflate the product-level escalation count

- **GIVEN** a product with no red-flag record and a linked activity that owns a
  blocked item
- **WHEN** `buildEscalationsFromReadSections` runs
- **THEN** no product-level flagged-red escalation is emitted for that product on
  account of the activity's blocker

### Requirement: The write path validates a record's activityId against the section's activities

The write path MUST validate every `activityId` carried on an
`items`/`risks`/`decisions` payload row against the section author's
server-loaded `section.activities` before `saveSection` persists — the same client-trust boundary the
stage-ownership guard (`validateStageOwnership`) and the activity-status guard
(`validateActivityStatuses`) already enforce for `projectId`/`stageNames` and for
`activityStatuses`. A payload row whose `activityId` is not one of the section's
attached activities MUST be hard-rejected with an `ACTIVITY_NOT_ATTACHED` error;
the delete-recreate MUST NOT trust a client-supplied `activityId`.

#### Scenario: a spoofed activityId on a record is rejected

- **GIVEN** a draft-save or submit payload whose item carries an `activityId`
  that is NOT attached to the section author
- **WHEN** the shared write guard runs before `saveSection`
- **THEN** the write is rejected with an `ACTIVITY_NOT_ATTACHED` error and no row
  is persisted

#### Scenario: a record on an attached activity passes the guard

- **GIVEN** a payload item whose `activityId` is one of the section's attached
  activities and whose product FK is null
- **WHEN** the shared write guard runs
- **THEN** the record passes the guard and persists with its `activityId`

### Requirement: Admin activity create/update/list uses linked product ids, not a scalar projectId

Dropping `ProjectActivity.projectId` means the admin activity contract MUST
express the product link as a set, not a scalar. `projectActivityCreateSchema`
and `projectActivityUpdateSchema` MUST replace the single `projectId` field with
a `linkedProductIds` array (0..N product ids), and the read/list contract
(`projectActivitySchema`) MUST replace `projectId` with a `linkedProducts` array
(id + name per link). The admin create/update handlers MUST reconcile the
`ProjectActivityProduct` join rows to match the submitted `linkedProductIds`.

#### Scenario: admin creates an activity linked to two products

- **WHEN** an admin creates an activity with `linkedProductIds` naming two
  products
- **THEN** two `ProjectActivityProduct` rows are written and the list contract
  returns both products under `linkedProducts`

#### Scenario: admin clears an activity's product links

- **GIVEN** an activity linked to one product
- **WHEN** an admin updates it with an empty `linkedProductIds`
- **THEN** the join rows are removed and the activity lists with an empty
  `linkedProducts`

### Requirement: A section attached only to activities can be submitted

A lead whose section is attached to activities but NO products MUST be able to
submit the section. The submit write schema (`submitSectionSchema`) MUST NOT
require at least one product status when the section carries only activities;
submit validation ranges over the union of product statuses and activity
statuses. Submit validation MUST mirror the per-product status loop for
activities: every activity attached to the section MUST carry a non-null
traffic-light status at submit — in the activity-only case AND the mixed case —
and a submitted activity with a null or absent status MUST be rejected, the
activity-level analogue of the missing-product-status rule. This tightens
`activityStatusInputSchema.status` (nullable/optional on draft) to non-null at
submit, the way `submitSectionSchema` already tightens `projectStatuses.status`.

#### Scenario: an activity-only section submits

- **GIVEN** a lead attached to one or more activities and zero products, each
  activity carrying a non-null status
- **WHEN** the lead submits the section
- **THEN** submission is accepted (the "at least one product status" rule does
  not block it)

#### Scenario: an activity with no status blocks submit

- **GIVEN** a lead attached to an activity that carries a null or absent status
- **WHEN** the lead submits the section
- **THEN** submission is rejected until that activity carries a traffic-light
  status

#### Scenario: a mixed section still requires each product's status

- **GIVEN** a lead attached to a product and an activity
- **WHEN** the lead submits without setting the product's status
- **THEN** submission is still rejected for the missing product status (the
  activity does not substitute for it)

### Requirement: Activity links and statuses use the normalized persistence model

Every activity-to-product link MUST be represented by one
`ProjectActivityProduct` row; `ProjectActivity` MUST NOT carry a direct
`projectId` field. An activity with no product links remains valid and has no
join rows. Persisted `ActivityStatus` rows MUST remain the stored source for the
explicit activity status, while the derived-status floor is applied at read time
without rewriting that value.

#### Scenario: a linked activity loads through its join row

- **GIVEN** a `ProjectActivity` linked to a product by one
  `ProjectActivityProduct` row
- **WHEN** the activity is loaded
- **THEN** that product link is present exactly once
- **AND** no direct `ProjectActivity.projectId` field is required

#### Scenario: an activity with no product link remains valid

- **GIVEN** a `ProjectActivity` with no `ProjectActivityProduct` rows
- **WHEN** the activity is loaded
- **THEN** it has an empty product-link collection and remains valid

#### Scenario: stored activity status is not rewritten by its derived floor

- **GIVEN** an `ActivityStatus` row whose effective status is raised by the
  derived floor
- **WHEN** the section is loaded
- **THEN** the response reflects the derived floor
- **AND** the stored explicit status remains intact

### Requirement: Duplicate linked-product ids are rejected as a clean validation error

A `linkedProductIds` payload containing a repeated product id MUST be
rejected — including a case-variant repeat of the same UUID (Postgres's
`uuid` type is case-insensitive) — at schema validation on
`projectActivityCreateSchema` and `projectActivityUpdateSchema`, rather than
being allowed to reach the database and collide with
`ProjectActivityProduct`'s `@@unique([activityId, productId])` constraint.
The schemas MUST emit `linkedProductIds` normalized to lowercase so every
downstream comparison operates on the canonical form. The repository layer
MUST additionally dedupe `linkedProductIds` case-insensitively before
writing the `create` path's join rows, and MUST use `skipDuplicates: true`
on the update path's `createMany` call, so a caller that bypasses the shared
schema still cannot trigger an unhandled Prisma unique-constraint error.

#### Scenario: a create payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.create` payload whose `linkedProductIds`
  contains the same product id twice
- **WHEN** the payload is validated against `projectActivityCreateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  database write is attempted

#### Scenario: a create payload with a case-variant duplicate is rejected

- **GIVEN** a `projectActivity.create` payload whose `linkedProductIds`
  contains the same UUID twice differing only in letter case
- **WHEN** the payload is validated against `projectActivityCreateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  database write is attempted

#### Scenario: an update payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.update` payload whose `linkedProductIds`
  contains the same product id twice (byte-identical or case-variant)
- **WHEN** the payload is validated against `projectActivityUpdateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  `ProjectActivityProduct` reconciliation is attempted

#### Scenario: an uppercase id is normalized to lowercase

- **GIVEN** a valid payload whose `linkedProductIds` contains an
  uppercase-lettered UUID
- **WHEN** the payload is parsed by `projectActivityCreateSchema` or
  `projectActivityUpdateSchema`
- **THEN** the parsed output carries the id in lowercase

#### Scenario: a non-schema caller with duplicated ids does not raise an unhandled Prisma error

- **GIVEN** a repository-level `create` or `update` call whose
  `linkedProductIds` contains a repeated id — byte-identical or
  case-variant — bypassing the shared Zod schema
- **WHEN** the repository builds the `ProjectActivityProduct` join rows
- **THEN** the duplicate is deduped (create path) or ignored via
  `skipDuplicates` (update path), and no `P2002` propagates out of the
  repository

### Requirement: getLiveActivity has regression coverage for its logic-bearing branches

`getLiveActivity` MUST have regression test coverage for its three
logic-bearing branches: a lead with no `ReportSection` for the current
report, the draft-before-submitted sort order across leads, and the
multi-source `lastEditAt` maximum across a lead's items, risks, decisions,
and comments. A test suite that only asserts `reportId`, `rows.length`, and
`leadId` on fixtures where every lead already has a section MUST NOT be
considered sufficient coverage for this method.

#### Scenario: a lead with no section reads as draft with zero activity

- **GIVEN** a lead in the caller's reporting group with no `ReportSection`
  row for the current report
- **WHEN** `getLiveActivity` runs for that group
- **THEN** the lead's row has `status: "draft"`, `itemCount: 0`, and
  `lastEditAt: null`

#### Scenario: draft-status leads sort before submitted-status leads

- **GIVEN** one lead with a `status: "draft"` section and another lead with
  a `status: "submitted"` section, both in the caller's group
- **WHEN** `getLiveActivity` runs for that group
- **THEN** the draft-status lead's row appears before the submitted-status
  lead's row in the result, regardless of each section's own
  `updatedAt`

#### Scenario: lastEditAt reflects the latest record across sources

- **GIVEN** a lead's section with an `Item`, a `Risk`, a `Decision`, and a
  `RecordComment` carrying distinct timestamps
- **WHEN** `getLiveActivity` computes that lead's row
- **THEN** `lastEditAt` equals the maximum timestamp across all of those
  records, not merely the section's own `updatedAt`
