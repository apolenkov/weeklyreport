# Review and acknowledgement is a cross-role capability; un-submit extends to designated reviewers

**Status:** proposed (locked via `grill-with-docs-codex` on 2026-06-30; not yet
implemented — tracked by `openspec/changes/review-acknowledgement`)

## Context

The only structured way to respond to a report is the head's, and the head's levers
are blunt: `Publish & Lock` (whole period) or a bare per-section revoke. There is no
comment, feedback, or acknowledgement concept anywhere in the schema. Demo feedback
asked for a lighter loop: per-group **reviewers** who can review any lead's section,
leave a comment pointing at the **concrete record** that is wrong, and **send the
section back** for rework without locking the period — plus a viewer "acknowledged"
receipt so the org knows who has seen a report.

The obvious modelling — a new `reviewer` enum `Role` — breaks on two facts:

- `Role` is single-valued per user (the admin sets exactly one of
  `lead/head/viewer/admin`). A `reviewer` role could not coexist with a **head who
  also reviews**, which the feedback explicitly wants.
- A new enum value detonates `role-coverage-gate` (nine reference-matched builders),
  the `Role` migration, and the default-role plumbing — heavy for an MVP experiment.

Reviewing is therefore an act several roles perform, not a class of person.
Separately, un-submitting a section is established as a **head capability** by
ADR 0008; letting reviewers send sections back widens that authority.

## Decision

Review and acknowledgement is a **capability carried by existing roles**, not a new
role:

- The new `review.*` procedures are built on the canonical `leadershipProcedure`
  (head + admin + viewer; lead excluded) + a group-scope check. No new enum role, no
  new middleware builder — `role-coverage-gate` is untouched.
- **Acknowledgement** (a group-level "seen" receipt) needs only group access — any
  head / admin / viewer can record it.
- **Verdict** (`approved` / `changes_requested`) and **per-record comments** require
  the caller be a **designated reviewer for that section's group**: the head of the
  group, an admin, or a viewer whose `ViewerGroupAccess.canReview` is true for that
  group. Designation is per-group and never crosses groups.
- A `changes_requested` verdict **automatically un-submits** the section
  (`submitted → draft`) — the same transition the head's revoke performs — inside a
  transaction that re-checks the section under the existing `ReportSection.version`
  optimistic lock. This **extends un-submit authority from head-only (ADR 0008) to
  designated reviewers**, including viewers with `canReview`.
- A review act never publishes, locks, reopens, or archives a period; its only state
  effect is the section-level un-submit, allowed only on an editable period.

This **amends ADR 0008.** ADR 0008's principle — un-submit/reopen is review, not
administration, and belongs with the head — stands; this widens the _set_ of
reviewers who may un-submit, with the same race-safe transition. It is **additive to
ADR 0007**: the viewer stays read-only for report _content_; review and
acknowledgement are an orthogonal write surface that does not mutate report rows.

## Consequences

- A viewer designated with `canReview` can un-submit a lead's submitted section. This
  is the intended outcome; the grant is explicit and per-group.
- The wider un-submitter set makes concurrent un-submits more likely, so the verdict
  path re-checks section state under the version lock (mirrors ADR 0008's race-safety
  consequence).
- `role-coverage-gate` keeps passing: the procedures use a recognized builder and the
  designation/group rules are in-handler authorization, not a new chain.
- "Viewer is strictly read-only" (ADR 0007) now means read-only for content; the
  glossary records the orthogonal review/ack write surface.
- A future AI review agent can author the same per-record comments without a schema
  break (the comment carries an author column today).
