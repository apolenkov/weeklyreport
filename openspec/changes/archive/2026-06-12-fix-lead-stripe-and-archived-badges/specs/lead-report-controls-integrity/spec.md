## MODIFIED Requirements

### Requirement: The product card stripe reflects the lead's own stages live

The lead edit-view product card stripe MUST derive its color live from
the worst status among the stages owned by the current lead (blocked >
at-risk > on-track); when every own stage is unset the stripe MUST be
neutral. The stripe MUST NOT read the persisted traffic-light value,
so the stripe and the visible chips can never contradict. The stripe
renders DASHED while any own stage is unset and solid once all own
stages carry a status; head dashboards and slides keep consuming the
persisted traffic light unchanged.

#### Scenario: a fresh week with no own statuses set

- **WHEN** the product card renders and the persisted traffic light is
  amber but every own stage is unset
- **THEN** the stripe is neutral and dashed, not amber

#### Scenario: an own stage turns blocked

- **WHEN** the lead sets one of their stages to blocked
- **THEN** the stripe immediately renders the blocked color

### Requirement: Controls with no effect are not rendered

A control whose action can have no visible effect in the current data
state MUST NOT render (preferred) or MUST carry an explicit
empty-state explanation. Specifically, the archive toggle on the lead
report page renders only when archived periods exist for this lead;
when rendered, it shows how many ("N archived") and toggling visibly
changes the period list. Archived entries MUST be marked with a
neutral "Archived" badge — a muted pill, never a status hue and never
raw bracketed text — in both the period selector and the Fill From
list; the period selector is a keyboard-accessible custom listbox so
the badge can render inside options.

#### Scenario: a lead with no archived periods

- **WHEN** the lead report page renders for a lead whose history has
  no archived periods
- **THEN** the archive toggle is absent

#### Scenario: a lead with archived periods toggles the archive

- **WHEN** the lead enables the archive toggle
- **THEN** archived periods appear in the period selector carrying the
  neutral "Archived" badge and the prev/next arrows navigate the
  expanded set

#### Scenario: archived rows in the Fill From list

- **WHEN** the Fill From list contains archived periods
- **THEN** those rows carry the same neutral "Archived" badge instead
  of any text prefix
