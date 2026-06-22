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

## Products, stages, items & scope

**Product**:
The unit a report is organized around (the `Project` row). Belongs to exactly
one reporting group (`GroupProduct`, one-group-per-product). Multiple leads can
contribute to one product within a period.
_Avoid_: project (the DB model name; in product language it is a "product").

**SDLC stage**:
One of the fixed lifecycle phases (`Planning`, `Analysis`, `Design`,
`Development`, `Testing`, `DevOps`, `Support`). An `Item` carries one or more
stage names; by convention an item carries exactly ONE stage (a person reports an
item against their own stage). Risks may legitimately span several stages.
_Avoid_: phase, step.

**Stage chip**:
The small pill on an item row naming its stage (and the contributing lead's
initials, e.g. "Development · ВИ"). It is an IDENTITY label only — uniform
treatment, NOT a status hue. Workflow status is conveyed separately (the row
stripe / a dedicated signal), never by the chip's fill.
_Avoid_: status badge (the chip is identity, not status).

**Workflow status** (of an item):
`in-progress` / `completed` / `blocked` / `planned`. Surfaced via the row's left
stripe or a dedicated marker — deliberately decoupled from the stage chip so one
control carries one meaning.
_Avoid_: stage (a stage is the SDLC phase, not the progress state).

**Decision**:
A choice a lead needs leadership to make, phrased as a yes/no or short
statement and recorded against ONE product. Like an item or a risk, a decision
is product-scoped: its SDLC stage options are the stages owned on the selected
product, and changing the product re-scopes them. (Earlier the decision dialog
drew stages from the department-wide union; that is no longer the model — all
three record dialogs share one product↔stage rule.) A decision's **owner** is
its author — the lead who raised it; ownership is implicit (set to the author on
create, preserved on edit) and is NOT separately assignable, so the dialog shows
no Owner field.
_Avoid_: discussion topic (a decision is a specific call, not an open question).

**Escalation / Needs Attention**:
A distinct head-facing call-out for a product (an `Escalation` row surfaced as the
"Needs Attention" banner). It MUST add information, never a verbatim copy of an
item already shown in the card.
_Avoid_: blocker (a blocker is an item/risk severity; the call-out is a summary).

**Scope** (the head report grouping axis):
`by product` — the full cross-lead portfolio aggregate of a product. `by lead` —
each product card sliced to ONE lead's own contribution (their items / risks /
decisions / stages), so a lead with two products shows two cards under them and no
other author's content mixes in.
_Avoid_: view (view = edit/slides mode; scope = the grouping axis).

**Own contribution**:
The records a lead authored in a period — their items, risks, decisions, and the
stages they own. In the default **Mine only** record visibility, the lead's own
report page shows only this for record content.
_Avoid_: my section (a section is the DB row; own contribution is the content a
lead is accountable for).

**Product context** (on a lead page):
The honest overall health of a co-owned product, derived from ALL contributing
leads' stages. In **Mine only** visibility it appears as status colour only (the
product health hue stays honest while foreign stage chips are hidden); in
**Everyone** visibility the co-owned product's foreign stage chips and records
become visible. It exists so a lead is not blind to a product they co-own going
red on a stage they do not own.
_Avoid_: by product (that is the head grouping axis, not a lead-page mode).

**Record visibility** (lead report page):
The lead-page toggle between two states. **Mine only** (default) shows only the
lead's own contribution and own stage chips; foreign records are not fetched and
foreign chips are hidden, while product health colour stays honest. **Everyone**
fetches and shows, read-only, the full records of co-owners on products the lead
co-owns — item / risk / decision text, the owning author's name, and the foreign
stage chips — bounded by the same access rule that governs Product context.
_Avoid_: scope (scope = the head's by-product / by-lead grouping axis; record
visibility is a lead-page own-vs-everyone toggle).

**Document action** (report toolbar vocabulary):
A toolbar control that operates on the report document itself — it creates,
persists, commits, or exports report content (Save, Submit Section, Publish &
Lock, Fill-From, PDF export). Distinguished from a Context control by what it
acts on, not by whether it writes.
_Avoid_: action (period nav is also "an action"); write action (PDF/version do
not write yet are document actions).

**Context control** (report toolbar vocabulary):
A toolbar control that changes which report is shown or how it is presented,
without operating on the document — period navigation, archive filter, scope,
view mode, expand-all, Agent review. A context control may persist a setting;
persistence does not make it a document action.
_Avoid_: filter (only some are filters); view control (view = the narrow
edit/slides mode; Context control is the broader umbrella).

## Slides & UI affordances

**Tooltip / hover affordance**:
There are THREE distinct hover-reveal systems — do not conflate them. (1) The
shared **Radix tooltip** (the `ui/tooltip` primitive, content rendered in a
portal so it is never clipped) — used by the pipeline "+N more" indicator, the
SDLC stage chips, the sidebar, and the Coming-Soon controls. (2) The separate
**stage-chip portal** (`sdlc-tooltip`, a `createPortal` singleton) that escapes
accordion `overflow:hidden`; it is NOT Radix. (3) The **Coming-Soon tooltip** —
the deferred-feature hover that shows the canonical amber `ComingSoonBadge`; it
rides on the Radix system.
_Avoid_: "the tooltip" unqualified (ambiguous across three systems); calling the
`sdlc-tooltip` portal "Radix".

**Slide capacity (soft cap)**:
The advisory ceilings on how much content fits a slide before it overflows:
`MAX_PRODUCTS_PER_LEAD` (products per person) and `SLIDE_SECTION_SOFT_CAP`
(records per section). They warn the author; they never block saving or adding.
Distinct from `MAX_VISIBLE_ITEMS`, the hard render truncation ("+N more") on the
Product-scope grid path.
_Avoid_: limit (a soft cap does not enforce); `MAX_VISIBLE_ITEMS` (that is render
truncation on a different slide path, not an authoring advisory).
