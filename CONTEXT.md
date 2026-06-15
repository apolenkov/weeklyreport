# CustomReport

Weekly status reports for a software department: leads fill structured
report sections, the head reviews/publishes/exports a unified report. This
glossary fixes terms that have been ambiguous or overloaded in the codebase.

## Testing & scenarios

**Behavioral Scenario**:
A human-readable description of observable behavior for a role on a route —
`role + route + intent + Given/When/Then expected outcome`. Anchored to what the
user sees, NOT to a code location, so it survives refactors. Executed live by a
Driver on every run; only critical, stabilized paths are later frozen into
deterministic Playwright specs.
_Avoid_: feature file (as a synonym for the catalog), test case, story.

**Scenario Catalog**:
The durable, high-level set of Behavioral Scenarios (`roles × routes × intents`)
that a human reviews and maintains. Deliberately NOT an exhaustive enumeration of
every element, state, or transition — that is structure-anchored and rots;
exhaustive coverage is produced by the Driver exploring at run time, not stored
as a frozen list. Distinct from the Coverage Catalog.
_Avoid_: behavioral catalog, test plan.

**Driver**:
The swappable executor that runs the Scenario Catalog against the live app —
either a human (manual checklist) or an AI agent (drives the browser, supplies
data, observes layout). Produces a report of what is broken, per role. Same
catalog, two interchangeable drivers.
_Avoid_: runner, executor (too generic), test bot.

**Role sweep**:
A per-role pass (`lead` / `head` / `admin` / `viewer`, via `/auth/dev-login`) in
which a Driver exercises that role's Behavioral Scenarios in a live browser and
reports anomalies (console errors, broken DOM/flow, layout, a11y). A reporting
tool in phase 1, NOT a blocking gate; it becomes a gate only once critical paths
are frozen into deterministic specs.
_Avoid_: smoke test, e2e run (too generic).

**Coverage Catalog**:
A generated map binding each scenario to the `file:line` of the code it
exercises, to detect uncovered entry-point surface. Brittle on an unstable
codebase (the `file:line` links rot on the first refactor); deliberately
deferred until the code stabilizes. Distinct from the Scenario Catalog.
_Avoid_: scenario catalog (when you mean the durable behavioral set).

## Reporting periods & submission

**Reporting period**:
The weekly window a report covers — the `Report` row itself. Carries the
lifecycle state machine (`open` / `published` / `reopened`) plus an `archived`
flag. A period is never "submitted"; submission is a per-lead act on a section
within the period (see _Lead submission_).
_Avoid_: week (the period is the window, not the calendar week label).

**Current period**:
The single active reporting period a role is working in now — `open` or
`reopened`, not archived. In a period navigator it is marked as current (e.g. a
check), distinct from past periods.
_Avoid_: latest period (a published-then-archived period can be the latest yet
not current).

**Lead submission** (a period is "submitted" _for a given lead_):
A period is "submitted" only from one lead's point of view: that lead has
submitted their own section for that period (`ReportSection.submittedAt` set).
It is per-lead and per-period — the same period can be submitted for one lead
and not another. It is NOT a property of the period and NOT the same as the
period being `published`.
_Avoid_: submitted period (no such global state — always qualify "for lead X").

**Archived period**:
A reporting period that has been closed and moved out of the active set
(`archived` flag). Independent of submission: a period can be archived without
the lead ever having submitted ("просто закрыли, человек не сделал"). In a
period navigator it reads quietly (neutral marker / basket), never as a status
hue.
_Avoid_: deleted (archived data is retained), locked (that maps to
`published`).
