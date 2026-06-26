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

**Period policy** (Settings → Periods sub-tab):
The organization-wide DEFAULTS and automation rules for how reporting periods
behave, stored on the `AppSettings` singleton. Two kinds: cadence/deadline
defaults (period length, working days, default deadline days, grace hours,
deadline time) and automation switches that real consumers read — the
period-creator / auto-publisher / auto-archiver schedulers and the request-path
late-submission and reopen guards (`autoCreatePeriods`,
`autoPublishAfterDeadline`, `autoArchiveWeeksAfterPublish`,
`allowLateSubmissions`, `allowReopenAfterPublish` + `reopenWindowHours`). It does
NOT create individual periods — that is _Period management_. Policy is the org
rule; management is the instance.
_Avoid_: period settings used loosely (say "period policy" for the org rules,
"period management" for the per-instance tab); "deferred / not wired yet" (most
policy knobs have live consumers — only describe a field as deferred when its
consumer genuinely does not exist).

**Period management** (Admin → Periods tab):
The CRUD-and-lifecycle surface for INDIVIDUAL reporting-period instances —
manually create / edit / publish / reopen / archive / delete a specific period,
listed by lifecycle state (active vs archived). It acts on one `Report` row at a
time. Distinct from _Period policy_, which sets the org-wide defaults that
automation applies across periods; the two are complementary, not duplicates.
_Avoid_: period settings (that is the policy sub-tab, not this instance tab).

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
period being `published`. A lead's **history aggregates** (the summary rail's
traffic-light totals, average items, total risks) count only _completed_
periods — those submitted, published, or archived; a draft period is provisional
and excluded, but disclosed beside the numbers ("N draft not included"). The
history list itself is ordered by reporting-period chronology (newest period
first), independent of when the section row was created.
_Avoid_: submitted period (no such global state — always qualify "for lead X").

**Archived period**:
A reporting period that has been closed and moved out of the active set
(`archived` flag). Independent of submission: a period can be archived without
the lead ever having submitted ("просто закрыли, человек не сделал"). In a
period navigator it reads quietly (neutral marker / basket), never as a status
hue.
_Avoid_: deleted (archived data is retained), locked (that maps to
`published`).

**Status observation (the viewer's relationship to a period)**:
The viewer role observes the **Current period** live — the same report content
the head sees, INCLUDING unsubmitted drafts — scoped to the viewer's granted
groups (`ViewerGroupAccess`), strictly read-only. The viewer is a _status
observer_, not a consumer of finished reports: visibility is NOT gated on
`published`. The resolved destination is the **Status target**: the Current period
when one exists with viewer-visible content, else the latest viewer-visible
published report (a published fallback is NOT a Current period — that term stays
reserved for the editable state). Search remains published-scoped, so a live
submitted record is readable before it is searchable — an accepted v1 divergence
(see ADR 0007).
_Avoid_: published-only viewer (the prior, reversed model — a viewer once saw a
report only once its period was `published`); consumer (a viewer watches live
status, not only completed reports).

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

**Stage assignment / unassigned stage**:
A stage belongs to a product for reporting only when a person is assigned to it
on that product (the stage×product slot is occupied). An **unassigned stage** is
a stage×product slot with no assignment — nobody is accountable for reporting it.
An unassigned stage is OUT of that product's reporting (not shown, not counted,
not awaited), as if the stage does not exist for the product. Exclusion is purely
assignment-driven — there is NO traceability carve-out: a risk or persisted
status NEVER keeps an unassigned stage visible. Health stays traceable anyway
because product health folds covering risks only through OWNED stages (a risk on
an unassigned stage never drove the traffic light), and the covering risk stays
listed in the risk section, so any severity is explained by a visible object
without the stage chip. Distinct from a **foreign-owned stage**, which IS assigned
(to another lead) and remains part of the pipeline.
_Avoid_: vacant chip / grey stage (an unassigned stage is excluded, not rendered
greyed).

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

**Report overview** (the summary band atop the report):
The at-a-glance grid above the report body. It is SCOPE-ADAPTIVE: in `by product`
scope it summarizes products (one card per product); in `by lead` scope it
summarizes leads (one card per lead that has content, carrying the lead's name,
their worst product status, and their summed record counts), and a card jumps to
that lead's group. The overview's grouping unit ALWAYS matches the report body's
grouping unit so the summary and the body agree.
_Avoid_: "Portfolio Overview" as a fixed product-only label (the overview's unit
follows scope; the heading adapts).

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
persists, commits, or exports report content (Save, Submit, Publish &
Lock, Fill-From, PDF export). Distinguished from a Context control by what it
acts on, not by whether it writes. The lead's commit control is labeled
**Submit** (not "Submit Section"): on the lead page a lead only ever sees their
own section, so "Section" added no information — it is the per-lead _Lead
submission_ act, kept visually distinct from the head's whole-report "Publish &
Lock".
_Avoid_: action (period nav is also "an action"); write action (PDF/version do
not write yet are document actions).

**Context control** (report toolbar vocabulary):
A toolbar control that changes which report is shown or how it is presented,
without operating on the document — period navigation, archive filter, scope,
view mode, expand-all, Agent review. A context control may persist a setting;
persistence does not make it a document action.
_Avoid_: filter (only some are filters); view control (view = the narrow
edit/slides mode; Context control is the broader umbrella).

## Identity & users

**User name (ФИО)**:
Authored as three parts — `lastName` (Фамилия, required), `firstName` (Имя,
required), `middleName` (Отчество / patronymic, optional). The single `name`
column is KEPT as a stored, denormalized display value recomputed from the parts
on write (not removed — SAML supplies only a combined `displayName` with no
parts, so a derived `name` would blank SAML users). Display forms come from the
parts: **full** «Берёзов Александр Владимирович», **short** «Берёзов А.В.»
(surname + dotted initials of the remaining parts; no patronymic → «Берёзов
А.»), and a **two-letter mark** «БА» (first letters of surname + given name, in
that order). Where each form appears is a fixed policy (see ADR 0006): the full
ФИО shows ONLY in the user's own top navigation badge; the two-letter mark is for
round avatar chips and the tightest inline marks (the item-row stage micro-chip
«Development · ВИ»); every other place a name is rendered as a spelled-out text
label — SDLC stage owners (own AND cross-author), slide owners + contributors,
the leads table, cross-author authors, dashboard escalations — uses the short
form. A foreign co-owner's short name is allowed to leave the server for the
cross-author stage label (it carries surname + initials, never the full ФИО).
_Avoid_: editing `name` directly (it is derived from the parts); first-word +
last-word initials (that yields surname + patronymic «БВ», a known bug); the full
ФИО anywhere except the user's own top badge.

**Position (должность)**:
A person's HR job title (e.g. «Тимлид», «Аналитик»). Free text, optional,
maintained only by the admin. Independent of Role: any access Role can hold any
job title. Keycloak carries its own должность attribute, but it is NOT pulled —
the admin owns this field.
_Avoid_: role (Position is the HR title; Role is the access level).

**Role**:
The access level a user has in the app — `lead` / `head` / `admin` / `viewer`.
Set ONLY by the admin; every newly registered user defaults to `viewer`. Not
carried by the IdP (Keycloak has no role attribute) and never synced from it. A
`viewer` not attached to any product sees nothing — they can only log in.
_Avoid_: position (Role is access, not the job title).

**Account (УЗ) / corporate email**:
A user's identity, keyed by their corporate email — which is also the SAML
identifier (`samlId`). SAML / Keycloak exists ONLY to authenticate and minimally
register a person on first login; it is not the source of the rich profile.
After that first registration the record is never re-synced from the IdP — the
admin owns the profile thereafter.
_Avoid_: login / username (the corporate email is the account key).

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
