## ADDED Requirements

### Requirement: Explicit quick and full modes

The tester-kit crawler MUST retain a quick pass and expose an explicit full pass.
Full traversal MUST discover controls in opened dialogs, menus, tabs and
disclosures before restoring the parent view. Bounds MUST be configurable and
every bound reached MUST be recorded as incomplete coverage.

#### Scenario: A dialog opens another menu

- **WHEN** full traversal opens a dialog with a nested menu within its depth bound
- **THEN** it explores both before restoring their parent
- **AND** it records each attempted control and any failed restoration

### Requirement: Coverage identifies concrete states

Full reports MUST preserve concrete report URLs and admin tab identity, include
found/pressed/skipped/error counts per page with skip reasons, and expose an
element by lifecycle state matrix. Repeated-row sampling MUST select a complete
representative row and identify the other rows as sampled out. Finite filter
values MUST receive deterministic pairwise coverage; unreachable assignments
MUST remain explicit failures or skips.

#### Scenario: The prepared report and its siblings

- **WHEN** a full run starts from the prepared entrypoints of a lifecycle state
- **THEN** the prepared report is visited by its concrete URL with its query views
- **AND** other records of the same page family discovered later are represented by one page
- **AND** evidence names the prepared state and actual page/control identity

### Requirement: Mutable runs use guarded synthetic preparation

The full tester-kit runner MUST isolate role, width and lifecycle-state runs on
the authorized synthetic database, prepare and verify its state, and restore
the canonical full seed after failures as well as success. PostgreSQL resets
MUST use the repository guard and consent token. Redis cleanup MUST select DB
15 explicitly and MUST reject a stand configured for another Redis DB.
External side effects and unreviewed dangerous handlers MUST be skipped with a
reason, regardless of a visible control's name.

#### Scenario: A mutable run exits with an error

- **WHEN** full traversal fails after synthetic preparation
- **THEN** cleanup attempts the guarded reset
- **AND** crawl and cleanup failures remain visible in the exit status and evidence

### Requirement: Evidence is never inferred from an attempted action

The crawler MUST capture observable outcomes, screenshots, response times and
console/network evidence. Unknown results, browser failures, missing fixtures
and failed checks MUST NOT be reported as passed. Full-mode timings MUST be
measured independently of quick-mode timings.

#### Scenario: A click cannot be observed

- **WHEN** a click fails or the resulting state is unavailable
- **THEN** its matrix entry records an error rather than successful coverage

### Requirement: Restoration waits for events

After a press the crawler MUST wait for the page to return to its parent state
through DOM events with a bounded timeout, and MUST NOT report a control as gone
while the page is still returning. Restoration MUST be accepted only when the
observable state equals the recorded parent.

#### Scenario: The page returns slowly

- **WHEN** a dismissed surface or a reload takes longer than the quiet window
- **THEN** the next control is pressed once the page shows its parent state
- **AND** a page that never returns is recorded as an error
