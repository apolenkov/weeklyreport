# activity-reporting-unit — delta: activity-first-class-reporting-unit

## ADDED Requirements

### Requirement: An activity carries the same reporting records as a product

A project activity MUST be able to own the same reporting records as a product —
current/next items, blockers, priorities, risks, and decisions — with one
difference: an activity carries NO SDLC stage. `Item`, `Risk`, and `Decision`
each reference EXACTLY ONE parent: a product (their existing product FK) or a
project activity (a new nullable `activityId`). A hand-written XOR CHECK
constraint (`(productFk IS NOT NULL) <> (activityId IS NOT NULL)`) MUST enforce
that exactly one parent is set on every row. Activity-parented records reuse the
existing positions machinery unchanged — `stableId` lineage, carry-over,
`RecordComment` anchors, `searchTsv`, and the `saveSection` delete-recreate. The
section read model MUST group an activity's records under that activity, the way
it groups a product's records under the product.

#### Scenario: a lead adds a current-week item to an activity

- **GIVEN** a lead whose section is attached to an activity
- **WHEN** the lead adds a current-week item and scopes it to that activity
- **THEN** the item persists with `activityId` set, its product FK null, and an
  empty `stageIds`
- **AND** the section read model returns that item grouped under the activity

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
with a message telling the lead to remove the risk/blocker first. Absent any risk
or blocker, the lead's manually chosen status stands (defaulting to on-track).

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

#### Scenario: no risk or blocker leaves the manual choice intact

- **GIVEN** an activity with no risks and no blockers
- **WHEN** the lead sets the pill to on-track
- **THEN** the on-track status is accepted and persisted

### Requirement: Activities render on the lead form, slides, and head report like products

Activities MUST render on the lead form, the lead slides, and the head report
with the same records/risks/blockers presentation a product uses, minus the SDLC
stage lane. On the lead form (`activity-status-section.tsx` /
`unified-activity-section.tsx`) each activity renders as a card carrying its
records and derived status, without a stage pipeline. On the slides
(`slide-activity-pills.tsx`, `lead-unified-slide.tsx`) the lead's activities are
grouped by traffic-light status. On the head report
(`activity-status-strip.tsx`, `weekly-report-page.tsx`) each activity renders in
the report body like a product — its records and linked product(s) — instead of a
status-only strip. Every surface MUST show the activity's linked product(s).

#### Scenario: the lead form renders an activity card without a stage pipeline

- **WHEN** a lead opens their report form for a section attached to an activity
- **THEN** the activity renders as a card showing its items/risks/blockers and
  its derived status
- **AND** no SDLC stage pipeline is rendered for the activity

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

### Requirement: A section attached only to activities can be submitted

A lead whose section is attached to activities but NO products MUST be able to
submit the section. The submit write schema (`submitSectionSchema`) MUST NOT
require at least one product status when the section carries only activities;
submit validation ranges over the union of product statuses and activity
statuses.

#### Scenario: an activity-only section submits

- **GIVEN** a lead attached to one or more activities and zero products, each
  activity carrying a status
- **WHEN** the lead submits the section
- **THEN** submission is accepted (the "at least one product status" rule does
  not block it)

#### Scenario: a mixed section still requires each product's status

- **GIVEN** a lead attached to a product and an activity
- **WHEN** the lead submits without setting the product's status
- **THEN** submission is still rejected for the missing product status (the
  activity does not substitute for it)

### Requirement: The activity schema migration preserves existing links and status rows

The schema migration MUST preserve every existing activity→product link and every
existing `ActivityStatus` row. The migration MUST backfill exactly one
`ProjectActivityProduct` row for each existing `ProjectActivity` whose
`projectId` is non-null before the `ProjectActivity.projectId` column is dropped,
so no label link is lost. Existing `ActivityStatus` rows MUST remain intact and
readable (the derived-status floor is applied at read time, not by rewriting the
stored status).

#### Scenario: an activity that had a product link keeps it after migration

- **GIVEN** an existing `ProjectActivity` with a non-null `projectId`
- **WHEN** the migration runs
- **THEN** one `ProjectActivityProduct` row links that activity to that product,
  and the `projectId` column is dropped with no link lost

#### Scenario: an activity with no product link migrates cleanly

- **GIVEN** an existing `ProjectActivity` with a null `projectId`
- **WHEN** the migration runs
- **THEN** zero `ProjectActivityProduct` rows are created for it and the activity
  remains valid

#### Scenario: existing activity status rows survive

- **GIVEN** existing `ActivityStatus` rows seeded before this change
- **WHEN** the migration runs and the section reloads
- **THEN** the stored statuses are intact and the derived floor is applied at
  read time
