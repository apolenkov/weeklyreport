# Design — toolbar two-row layout

## Organizing axis

One axis decides the row: **does the control operate on the report document, or
does it only change which report you see and how it is presented?**

- Rejected axis "mutates data vs read-only": the visibility scope persists a
  setting (a mutation) yet is a framing control, and PDF/Version do not write
  yet are document operations. The mutation axis splits the wrong way; the
  document-vs-context axis matches user intent. (Proven by two marker controls:
  PDF — no data change — reads as a document operation; Mine|Everyone —
  persists — reads as framing.)

## Row composition

Top row = **Document action**; bottom row = **Context control**.

| Role             | Top row (Document action)                                 | Bottom row (Context control)                                                                           |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| lead             | Version⏳ · PDF⏳ · Fill-From · Save · **Submit Section** | Agent review² · ◀ Prev · date · Next ▶ · Show-archived¹ · Mine\|Everyone · Edit\|Slides · Toggle All |
| head (open)      | PDF · **Publish & Lock**                                  | Agent review² · ◀ Prev · date · Next ▶ · Show-archived¹ · Product\|Leads · Edit\|Slides              |
| head (published) | PDF · Move-to-archive · **Reopen** (neutral)              | (same context row)                                                                                     |
| viewer           | PDF                                                       | Agent review² · Back to Archive · ◀ Prev · date · Next ▶                                             |

`⏳` = an existing inert Coming-soon control occupying its slot.
¹ Show-archived renders only when archived periods exist (lead-report-controls-integrity).
² The inert Agent-review placeholder leads the context group: `head-toolbar-semantics`
requires it at the leading edge of its control group ("first element of the group"),
which takes precedence over a trailing position. If live verification shows the
leading-before-period-nav placement reads poorly, relocate it to the leading edge of
the toggle sub-cluster and adjust the `head-toolbar-semantics` scenario wording to
match — recorded here, not changed silently.

### Two archive surfaces (not one "Archive")

There are two distinct head archive controls; the axis splits them:

- **Show archived periods** — a filter over which periods are listed → Context
  control (bottom row).
- **Move to archive** — a lifecycle action on a published report → Document
  action (top row), neutral/outline (it is not the single forward primary).

### Viewer / lead-preview inheritance (precise)

The two-row structure is a property of the shared `ReportToolbar`. `viewer` and
the lead preview render the same `WeeklyReportPage` but compose their own
controls through the page's `headerActions`/toolbar slots. Viewer's top row
holds only PDF (its requester-scoped published slice) — no commit control. The
viewer `Back to Archive` navigation and the `AgentReviewComingSoon` placeholder
are Context controls (bottom row), not top-row document actions. The lead
preview renders its own outer header; its inherited toolbar still carries no
commit control.

## Colour hierarchy (variant B)

- The single **forward primary commit** is solid brand-green
  (`--color-starbucks-accent`): `Submit Section` (lead), `Publish & Lock`
  (head). Both already gate behind a confirm dialog.
- Other document actions (Fill-From, PDF, inert stubs) take an **accent
  outline / ghost** — present but not competing with the primary.
- **Reversal** lifecycle actions get a neutral/outline treatment, NOT green:
  `Request Reopen` (lead), `Revoke` (lead), `Reopen` (head). Green stays a
  single meaning — "forward and safe to commit" — consistent with the
  documented discipline that a hue carries one meaning (CONTEXT.md stage-chip
  rule; status-color-semantics).
- The bottom row carries no brand-accent _primary-action_ fill. Two existing
  treatments are explicitly exempt because they do not signal a commit:
  - the segmented-control **active-state** indicator on the scope and view-mode
    toggles (required by `head-toolbar-semantics` to use the accent token);
  - the transient **Save busy** state (required by
    `lead-report-controls-integrity` to render accent green while in flight) —
    it is a momentary status, not a second resting primary.

## State behaviour (positional stability)

The top row keeps stable slots; state changes the meaning of the primary
button, not the row's shape.

| State                      | Top row                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lead draft                 | Version⏳ · PDF⏳ · Fill-From · Save · **Submit Section**                                                                                                     |
| lead submitted             | Save hidden (autosave settled) · **Submit Section → Request Reopen** (neutral)                                                                                |
| lead read-only past period | real mutating actions (Save/Submit/Fill-From) hidden; inert Coming-soon stubs stay visible (deferred-feature-pattern forbids omitting them); bottom row stays |
| head period open           | PDF · **Publish & Lock**                                                                                                                                      |
| head published             | PDF · **Publish & Lock → Reopen** (neutral)                                                                                                                   |

This matches current code: `PublishLockButton` already toggles publish/reopen
by `periodStatus`; `SaveNowButton` already hides under `isReadOnly`.

## Status indicators

`Live · X/Y Submitted`, the autosave timestamp, and the "No submitted content
yet" publish hint are neither document actions nor context controls. They stay
on the status/header line above the two rows, unchanged.

## Copy rename

`Submit Report` → `Submit Section`. The glossary states a period is never
globally "submitted" — submission is a per-lead act on a section. Update the
button copy and the tests asserting `Submit Report`. This is the only
user-facing string change; it stays English per the UI-strings rule.

## Responsive

No new breakpoint logic, but the bottom row now carries more controls, so
`overflow-x-clip` is not acceptable as-is — it could clip context controls out
of reach on narrow viewports. Each row MUST keep every control reachable via
horizontal scroll or wrapping. The change is the vertical split plus this
reachability guarantee, not a full responsive redesign.

## Forced corrections from Codex round 1 (vs the Act-1 lock)

Two Act-1 decisions were tightened because durable specs forbid the simpler
form — surfaced to the user, not silently changed:

- **Read-only lead top row** was "hidden entirely"; `deferred-feature-pattern`
  forbids omitting inert Coming-soon controls. Corrected: hide only the real
  mutating actions; keep the inert stubs visible.
- **"Archive" in the bottom row** conflated two controls. Corrected: the
  show-archived filter stays a context control; the published-period Move to
  archive is a document action (top row).
