# ui-crawl Specification

## Purpose

Defines how the tester-kit crawler walks the running UI in quick and full modes, records which controls and lifecycle states were actually exercised, and reports unexplored coverage instead of hiding it.

## Requirements

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

### Requirement: Crawler diagnostic failures retain their cause

The crawler MUST allow environment-only secrets only when the file is absent; other read failures MUST retain path and cause without revealing contents. CLI bootstrap MUST obey configured time/output limits. Failed CLI output MUST be recovered only when complete valid batch results are available; invalid output MUST retain the original exit and stderr.

#### Scenario: Secret file exists but cannot be read

- **WHEN** secret-file reading fails for a reason other than absence
- **THEN** configuration reports its path and original cause even if environment credentials exist

#### Scenario: CLI bootstrap stalls or batch output is truncated

- **WHEN** bootstrap exceeds its timeout or failed batch output is incomplete
- **THEN** the original bounded CLI failure remains observable

### Requirement: Login and page retries preserve diagnostic ownership

Crawler login MUST keep four bounded attempts and back off only between attempts. Terminal failure MUST retain the final cause and attempt count without exposing credentials. Quick and full page retries MUST retain distinct page and sign-in failures when all attempts fail, while discarding abandoned findings after a successful retry.

#### Scenario: All four login attempts fail

- **WHEN** authentication fails four times
- **THEN** exactly three backoffs occur and the final cause remains attached

#### Scenario: Page retry cannot sign in

- **WHEN** page loading and secondary sign-in both fail
- **THEN** both failures are distinguishable in the terminal diagnostic

### Requirement: Log draining clears only confirmed observations

The crawler MUST read each log source before clearing it. A failed read MUST remain explicit and its source MUST NOT be cleared. Successfully read sources MUST remain reportable even when another source fails. Clear failures MUST be reported after delivering read evidence.

#### Scenario: A log read or clear fails

- **WHEN** one source cannot be read or cleared
- **THEN** its failure is reported and other successfully read evidence is preserved
- **AND** unread sources remain uncleared

### Requirement: Admin tabs are walked in full once per run

Admin tabs other than Periods and Reopen show the same content in every
lifecycle state. A multi-state run MUST walk every admin tab and the PDF page
once, in the first state, and MUST walk only the lifecycle-dependent tabs
(Periods, Reopen) in the later states. The report MUST name the state each
admin page was walked in.

#### Scenario: A run covers several states

- **WHEN** a full run covers the states returned and published
- **THEN** admin tabs Users, Groups, Products, Activities, Reminders, Jobs, Actions, AI and Settings are walked once, in returned
- **AND** Periods and Reopen are walked in both states

### Requirement: A page with a default view is one page

A page opened with the default value of a view query (admin tab Users, AI
sub-tab Provider, settings sub-tab Identity) MUST be the same page as its bare
URL, so a run MUST NOT walk it twice.

#### Scenario: Link discovery finds the explicit default URL

- **WHEN** a page links to `/admin?tab=users` after `/admin` was walked
- **THEN** the page is not walked again

### Requirement: Two runs of one state press the same controls

The press and `gone` counts per role and width MUST NOT depend on timing: a
control is reported gone only after the page had the chance, bounded and driven
by DOM events, to show it again, in quick mode as well as in full mode. A page
that never returns to its first-visit state MUST be reported as a finding
instead of being silently reduced to gone controls. `compare.ts` MUST compare
two runs and exit non-zero when a count differs.

#### Scenario: Two quick runs on a freshly reset stand

- **WHEN** the quick walk runs twice in a row on the demo seed
- **THEN** every role at every width has the same pressed, skipped and gone counts in both runs

### Requirement: Failed batch recovery preserves observed work

The crawler MUST read completed press evidence before fallible recovery actions. It MUST preserve the original batch failure and separate recovery failures. Failed page restoration MUST stop dependent presses and mark coverage incomplete. Unknown request consumption MUST remain unavailable and MUST NOT refund the outstanding reservation.

#### Scenario: Restore fails after a completed press

- **WHEN** a batch times out after completing a press and page restoration fails
- **THEN** the completed press and original timeout remain in the result
- **AND** the restoration failure is reported and no dependent press runs

#### Scenario: Recovery storage is unavailable

- **WHEN** completed press evidence cannot be read
- **THEN** the read failure is explicit and coverage remains incomplete
- **AND** the request count is unavailable rather than zero

#### Scenario: Full traversal cannot restore a failed batch

- **WHEN** a full-mode batch fails after a completed press and page restoration fails
- **THEN** the completed timings and logs remain in the page record with error completion
- **AND** no screenshot, dependent control, combination or rebase reads the unknown page
