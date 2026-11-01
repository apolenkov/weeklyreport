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

### Requirement: Repeated presses verify live identity

The crawler MUST repeat an action only when its live control retains the complete normalized name, native tag, role and original probe anchor. Empty identity or unavailable controls MUST NOT authorize synthetic events. A mismatch MUST leave the observed state available to the existing bounded restoration path.

#### Scenario: A replacement shares the original label prefix

- **WHEN** the original control is replaced by a different action with a shared label prefix
- **THEN** no repeated event is sent to the replacement

#### Scenario: The same toggle remains available

- **WHEN** the original identified toggle remains available after its first press
- **THEN** repeating it can restore the original observed state

#### Scenario: Availability changed

- **WHEN** the identified control becomes disabled or covered
- **THEN** no repeated event is sent

### Requirement: Native select assignments are checked at action time

The crawler MUST recheck native select type, enabled state and option availability before changing a value. Unavailable assignments MUST NOT dispatch events or count as successful presses. Full traversal MUST retain its exact planned value. Quick traversal MUST choose another enabled option only when its still-available planned value has become current.

#### Scenario: Availability changes after probing

- **WHEN** the select or planned option becomes disabled, disappears or changes type
- **THEN** the attempt is explicitly unsuccessful and input/change are not dispatched

#### Scenario: Current value changes after probing

- **WHEN** the planned option becomes the current value
- **THEN** quick traversal can choose a different enabled option
- **AND** full traversal preserves the exact assignment without claiming a new press

#### Scenario: A valid assignment

- **WHEN** an enabled native select has the enabled planned option
- **THEN** its value changes to that option and input/change events are dispatched

### Requirement: Quick restoration compares live field state

Quick crawler state comparison MUST include deterministic live non-password input, textarea and select values, including selected options. Password values MUST NOT enter signatures. Existing checked, URL, surface, expanded and visible text state MUST remain part of comparison.

#### Scenario: A live field changes without changing page text

- **WHEN** a supported live field value changes
- **THEN** quick restoration detects the changed state and either restores it or reports incomplete restoration

#### Scenario: Password changes

- **WHEN** a password field changes
- **THEN** its value remains absent from crawler signatures

### Requirement: Current press receives its own long-task measurement

The crawler MUST finish the action task and collect long-task observations before returning press evidence. Each measurement MUST describe the action interval, excluding tasks from previous presses.

#### Scenario: Synchronous slow handler

- **WHEN** a press synchronously blocks the main thread for 250 ms
- **THEN** that result reports the blocking duration
- **AND** the next fast press does not inherit it

### Requirement: Geometry observations distinguish offscreen and scrollable controls

Crawler obstruction checks MUST use a point inside the control's visible viewport intersection. Fully offscreen controls MUST remain discoverable without unrelated edge obstructions. Hidden or clipped overflowing content MUST be reported unless intentionally truncated or internally scrollable in a native editable control; accessible auto/scroll overflow MUST NOT alone count as clipping.

#### Scenario: Offscreen control beside an unrelated viewport edge control

- **WHEN** a control lies fully outside the viewport
- **THEN** it remains discoverable without an obstruction finding from the edge control

#### Scenario: Hidden content and accessible scrolling

- **WHEN** native geometry shows hidden/clip overflow or accessible auto/scroll overflow
- **THEN** only unavailable content is reported as clipping
- **AND** intentional ellipsis and native editable scrolling remain allowed

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

The crawler MUST read completed press evidence before fallible recovery actions. It MUST preserve the original batch failure and separate recovery failures. Failed page restoration MUST stop dependent presses and mark coverage incomplete. Unknown request consumption MUST remain unavailable and MUST NOT refund the outstanding reservation. Failure to persist batch evidence MUST return the completed rows with the original storage failure, stop dependent work and mark coverage incomplete without rereading earlier rows as new evidence.

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

#### Scenario: Initial batch persistence fails

- **WHEN** resetting the current batch storage fails before any observation completes
- **THEN** the failed batch returns no completed rows and reports the storage cause
- **AND** no control is acted on and older stored rows are not reused

#### Scenario: Persistence fails after an observation completes

- **WHEN** persisting a completed row fails
- **THEN** the row and original storage cause remain observable
- **AND** quick and full traversal stop dependent actions with incomplete coverage
- **AND** unknown request consumption is not refunded

### Requirement: Reused XHR observations retain request identity

The tester-kit crawler's press evidence MUST report each completed XMLHttpRequest once with that request's current method and URL, including when the page reuses the same native request object. Reusing a request MUST NOT accumulate lifecycle listeners or leave completed requests counted as in flight.

This observation contract covers asynchronous native requests with string methods and URLs, including ordinary event handlers that reuse or send the object. It does not cover synchronous XHR or guarantee ordering before a capture listener registered earlier on the same object.

#### Scenario: Two requests reuse one native object

- **WHEN** a page sends two sequential GET requests with different URLs through one XMLHttpRequest
- **THEN** crawler evidence contains exactly two network rows with the respective URLs
- **AND** the in-flight count returns to zero

#### Scenario: Reusing an aborted request

- **WHEN** a page aborts an XMLHttpRequest and then uses it for another request
- **THEN** the aborted request finishes accounting under its original metadata
- **AND** the next request is reported once under its new metadata

#### Scenario: Replacing an active request with native open

- **WHEN** native open replaces an active request without an explicit abort
- **THEN** the previous request stops contributing to the in-flight count
- **AND** completing the next request returns the count to zero and reports its URL once

#### Scenario: Native open rejects an invalid method

- **WHEN** native open throws for an invalid method
- **THEN** its native error propagates and any existing active request retains its metadata and count
- **AND** a later valid request does not install another listener pair

#### Scenario: An ordinary completion handler reuses the object

- **WHEN** an ordinary onload handler opens and sends another request on the same object
- **THEN** each completed request is reported once under its own metadata
- **AND** the final in-flight count is zero

#### Scenario: An ordinary OPENED handler sends a request

- **WHEN** an ordinary OPENED handler sends the request or performs a nested open followed by send
- **THEN** the in-flight count becomes one and returns to zero on completion
- **AND** the completed request is reported once under the URL that was actually sent

### Requirement: Shared request ledger rejects corrupt history

The crawler request reservation boundary MUST reject a persisted ledger row
unless it has exactly two integer fields: a nonnegative safe timestamp and a
signed safe request count. It MUST surface corruption before admitting a
request, preserve the original ledger bytes, and release its lock. An empty or
absent ledger MUST remain valid first-run history.

#### Scenario: Non-finite or malformed persisted row

- **WHEN** the crawler reserves a request using history with a non-finite field,
  missing or extra field, or malformed integer
- **THEN** reservation fails with an explicit ledger integrity error
- **AND** no request is admitted and the history is neither reset nor compacted

#### Scenario: Valid signed correction

- **WHEN** a completed action consumed fewer requests than it reserved
- **THEN** its signed correction remains part of the original minute's budget
- **AND** another reservation uses the corrected total

#### Scenario: First reservation

- **WHEN** the persisted ledger is empty or absent
- **THEN** reservation initializes history normally

### Requirement: Existing crawler request history fails closed

The crawler MUST treat only an absent request ledger as empty history. Other read failures MUST preserve their cause and prevent another reservation from being appended. Valid signed corrections MUST retain the existing request-budget semantics.

#### Scenario: Existing history is writable but unreadable

- **WHEN** the crawler cannot read existing rate history although appending would succeed
- **THEN** it reports the original filesystem error and adds no reservation

#### Scenario: First request has no ledger

- **WHEN** the request ledger is absent
- **THEN** the crawler can reserve within the existing budget and create its history

#### Scenario: A reservation consumed fewer requests

- **WHEN** a measured request count is less than its reservation
- **THEN** its negative correction retains the existing budget refund

### Requirement: Probed inputs carry implicit roles without widening the full walk

The crawler probe MUST report an `<input>` without a non-empty explicit role
by its html-aria implicit role: `button`, `submit`, `reset` and `image` as
`button`, `number` as `spinbutton`, `range` as `slider`, `checkbox` and
`radio` as themselves, `text`, `email`, `tel` and `url` as `textbox`, and
`search` as `searchbox`; any of those five with a `list` attribute MUST report
`combobox`. A type without an implicit ARIA role, such as `password` or
`date`, MUST report no role, and an unknown or invalid type MUST be
treated as the browser's `text`. An empty `role` attribute MUST fall back to
the implicit role. The full-walk write guard MUST require a named scenario
for every `<input>` other than checkbox and radio, decided by tag and DOM type
and independent of the reported role, and for every `textbox`; buttons,
checkboxes and radios MUST keep their current admission.

#### Scenario: Native number, range and input button

- **WHEN** the probe reads `number`, `range` and `submit` inputs
- **THEN** they are reported as `spinbutton`, `slider` and `button`
- **AND** the full-walk guard still requires a named scenario for each

#### Scenario: No implicit role or an invalid type

- **WHEN** the probe reads a `date` input and an input with an invalid type
- **THEN** the date input has no role and the other is a `textbox`
- **AND** both still require a named scenario

#### Scenario: Password, search and suggestion inputs

- **WHEN** the probe reads a `password` input, a `search` input and an
  `email` input with a `list` attribute
- **THEN** they report no role, `searchbox` and `combobox`
- **AND** each still requires a named scenario

#### Scenario: Unchanged safe controls

- **WHEN** the full walk plans a button, a checkbox input or a radio input
- **THEN** its admission is the same as before the role correction
