# Design — review-acknowledgement

MVP / experimental. The smallest coherent slice that delivers a non-locking review
loop, per-record feedback, an acknowledgement receipt, and a submitted-only default
view. Locked via `grill-with-docs-codex` (Act 1). The Act-1 Codex blind-spot consult
hung twice on the long exploratory prompt (a known 0%-CPU quota/throttle stall — a
short probe returned fine); the adversarial pass below was produced directly and via
the advisor reviewer instead.

## Data model

Three new tables plus one flag. No change to `Item` / `Risk` / `Decision` text.

- **`ViewerGroupAccess.canReview: Boolean @default(false)`** — designates a viewer
  as a reviewer FOR THAT GROUP. Per-row, so designation never crosses groups.
- **`ReviewAcknowledgement`** — `(userId, reportId, groupId)` unique; `seenAt`. The
  group-level "seen" receipt: `reportId` pins the period and `groupId` makes it
  per-group, so a viewer with access to two groups in one period can acknowledge
  one without the other. Idempotent upsert.
- **`SectionReview`** — one row per `(reportSectionId, reviewerId)`; `verdict`
  enum `approved | changes_requested`; `judgedVersion` (the `ReportSection.version`
  the verdict was made against); `createdAt`, `updatedAt`. The per-section verdict
  (upsert). A verdict is **current** only while `judgedVersion` equals the section's
  current `version`; a re-submission bumps `version`, so a prior verdict goes stale
  automatically with no clearing step (see "Verdict lifecycle" below).
- **`RecordComment`** — `reviewerId`, `text`, and a record anchor. Anchor as a
  discriminated FK trio (`itemId? | riskId? | decisionId?`, exactly one set) with
  `onDelete: Cascade` on each, so a comment dies with its record. Flat (no parent
  ref). A nullable `reviewerId` + an `authorKind` is NOT added now, but the column
  set leaves room for a future non-human (AI) author without a breaking change.

Why three tables, not one: acknowledgement is group/period-grained, the verdict is
section-grained, and comments are record-grained — collapsing them would force null
columns and a discriminator for no MVP benefit. They compose; they do not duplicate.

## Authorization

All `review.*` procedures are built on the canonical **`leadershipProcedure`**
(head + admin + viewer; lead excluded) — no new builder, so `role-coverage-gate`
stays green. The tiering is enforced in the handler:

- **Ack** — requires only that the caller's group scope covers the target report's
  group. `groupScopeFilter(session, ...)` already encodes head/viewer/admin scope.
- **Verdict / comment / un-submit** — additionally requires the caller be a
  designated reviewer for the SECTION'S group: head of that group, admin, or a
  `ViewerGroupAccess` row for that group with `canReview = true`. The check resolves
  the section → its group, then tests designation against THAT group, never "any
  group the caller can review".

## Un-submit reuse + concurrency

`changes_requested` performs the SAME state transition as the head's existing
per-section revoke (`submitted → draft`, clear `submittedAt`, stamp the un-submitter).
It MUST run in a transaction that re-reads the section and confirms `status =
submitted` and the expected `ReportSection.version` before writing — the optimistic
lock the codebase already uses — so two concurrent `changes_requested`, or a race
with the head's revoke, transition exactly once (mirrors the race-safety the
`reopen-request-lifecycle` change established for reopen decisions, ADR 0008).

## Verdict lifecycle (re-submission)

A verdict must not outlive the submission it judged. `SectionReview.judgedVersion`
records the `ReportSection.version` at verdict time; a verdict is current only while
that equals the section's `version`. The flow `changes_requested → lead edits →
re-submit` bumps `version`, so the prior verdict reads stale and a re-submitted
section is "awaiting review", not still "needs changes" — without a separate
clearing step. This reuses the optimistic-lock version the un-submit race-check
already reads, so there is one source of truth for "has this section changed since".

## Submitted-only default + anti-empty-state guard

The toggle filters sections within an already-authorized period; it never touches
the read gate (`viewer-report-navigation` keeps its published-or-current gate
verbatim). The one real trap, caught in the grill: the head's
`head-report-visibility` requirement exists BECAUSE a past bug showed the head an
empty report. A naive submitted-only default re-creates it when every section is
draft. Guard: when draft content exists but is filtered out, render a "N in draft —
show all" signal, NOT the genuine "No submissions yet" empty state (which stays for
a content-less period). The same guard covers a reopened period (whose sections are
all draft).

## Adversarial pass (Codex-substitute) — risks and how each is handled

1. **Concurrency — reviewer un-submits while another acts.** Handled by the
   transactional `version` re-check above (transition once).
2. **Authz leak — `canReview` across groups.** The designation check is keyed on the
   section's group, and `canReview` lives per `ViewerGroupAccess` row, so a group-A
   reviewer is FORBIDDEN on group B (covered by a scenario + test).
3. **role-coverage-gate.** New procedures ride `leadershipProcedure`; designation is
   in-handler, not a new chain. Gate stays green (scenario + test).
4. **Carry-over interaction.** Comments anchor to a record id; carry-over CLONES
   records into the next period with NEW ids and does not copy comments — so a
   comment stays bound to the period it was made on. No special handling; assert it
   in a test so a future carry-over change does not silently start copying comments.
5. **Published-snapshot read path.** The toggle is live-current-period only; the
   snapshot renders as-is (ADR 0010). No snapshot reconciliation, no reopened
   stickiness — exactly the complexity ADR 0007 declined.
6. **Lead editing a commented record after return.** Cascade handles deletion;
   on edit the comment persists (possibly stale) — acceptable for MVP, no
   resolution workflow. A re-submit is implicitly a new review round.
7. **Over-engineering.** No threads, no notifications, no AI, no resolution state,
   no per-record verdict — all explicitly out of scope.
8. **Stale verdict after re-submit** (advisor-caught). A persisted `changes_requested`
   would otherwise linger on a re-submitted section. Resolved by binding the verdict
   to `judgedVersion` (see "Verdict lifecycle") — no clearing step.

## ADRs

- **ADR 0009** — review/acknowledgement is a cross-role capability (not a new role);
  un-submit authority extends from head-only to designated reviewers. Amends 0008.
- **ADR 0010** — head/viewer default to submitted-only on the live current period,
  toggle to all; scoped to the live period so the published snapshot is untouched.
  Amends 0007's v1 "show drafts by default" call.

## Out of scope

AI review agent · comment reply-threads · Telegram/email delivery · per-record
verdict · restricting reviewers beyond `canReview` · filtering the published
snapshot by submission state.
