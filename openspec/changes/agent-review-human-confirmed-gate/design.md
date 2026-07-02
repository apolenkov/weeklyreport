# Design — Agent-Review Human-Confirmed Gate

## D1. Two capabilities, split on the live/deferred seam

HF3 (relocate the strip) and HF9 (review-mode split) are **live** work: neither
depends on an agent existing; both improve the human review flow today. HF7
(Agent-review affordance) and HF8 (human-confirmed gate) are **specced but
deferred** behind the existing `AgentReviewComingSoon` placeholder.

Filing all four under one `agent-review` capability would misfile the review-mode
split and the strip relocation as agent-specific. The repo already favours small,
single-purpose capabilities (`report-badge-resolution`, `report-toolbar-parity`),
so two capabilities is idiomatic:

- `report-review-mode` — HF3 + HF9. Ships now.
- `agent-review` — HF7 + HF8. Specced now; the agent-invocation half stays
  deferred.

## D2. Zero MODIFIED deltas — deliberate skip

Per `openspec-cross-capability-delta-discriminator`: modify an existing
requirement only where the change makes it **contradictory**, otherwise
single-home the new behaviour and record the skip. Every candidate here is
_reinforced_, not contradicted:

- `deferred-feature-pattern` → "Agent-Review Placeholder Covers Every On-Screen
  Report Surface" governs report-**content** surfaces and mandates _exactly one_
  placeholder per such surface. The strip is a review-**affordance** surface, not
  report content, and the new strip control is an _additional_ placeholder home,
  not a second placeholder on a content surface — the existing requirement stays
  true verbatim. `report-review-mode` also pins the header placeholder as
  always-on in both modes, which upholds it.
- `deferred-feature-pattern` → "Backend-Deferred Paths Throw a Loud Stub Error"
  is generic; the agent-review procedures are instances, asserted directly in the
  `agent-review` spec.
- `reopen-requests` (head/admin-gated decisions) and `role-coverage-gate`
  (canonical builders) are both preserved and cited, never altered.

Consequence: this change is **all ADDED, single-homed**, which removes the
verbatim-header-match hazard from `openspec validate --strict` entirely.

## D3. Schema — separate `AgentReviewProposal` table (recommended)

HF8's whole point is that an unconfirmed agent verdict is **inert**. Two ways to
guarantee it:

**Option A — extend `SectionReview`.** Add `reviewerKind`, `agentModel`,
`confirmationStatus`, `confirmedById`, `confirmedAt`; make `reviewerId` nullable;
add a partial unique `WHERE reviewerKind='agent'`. Cost: _every_ read path that
consumes `SectionReview` must now filter out unconfirmed agent rows —
`toReviewViews` (`report-sections.prisma-repository.ts:371`, sets `isCurrent`),
the resolved badge (`section-verdict-control.tsx:resolveBadge`), and the head
`review.dashboard` counts (`review.service.ts:getSubmissionDashboard`). Inertness
becomes _enforced-by-filtering_; one missed read path leaks a phantom "Changes
requested."

**Option B — separate `AgentReviewProposal` table (recommended).** An
unconfirmed proposal is _structurally_ invisible to the verdict read paths
because it is not a `SectionReview` row — nothing to filter, nothing to leak. No
nullable FK, no partial-unique surgery on `SectionReview`.

The `SectionReview`/`RecordComment` schema comments ("room for a future non-human
reviewer") describe the _column set_, not the confirmation lifecycle, so they do
not settle this. Given HF8, prefer the option where inert-until-confirmed is
_impossible to violate_.

Recommended shape:

```
enum AgentReviewProposalStatus { proposed  confirmed  dismissed }

model AgentReviewProposal {
  id              String  @id @default(uuid())
  reportSectionId String
  verdict         ReviewVerdict          // reuse approved | changes_requested
  judgedVersion   Int                    // section.version at agent-judge time
  agentModel      String                 // author attribution (e.g. model id)
  rationale       String?                // agent's stated reason, optional
  status          AgentReviewProposalStatus @default(proposed)
  confirmedById   String?                // the human confirmer (audit trail)
  confirmedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  reportSection   ReportSection @relation(fields: [reportSectionId], references: [id], onDelete: Cascade)
  confirmedBy     User?         @relation(fields: [confirmedById], references: [id])

  @@index([reportSectionId])
}
```

**At most one pending proposal per section.** A partial unique index
`AgentReviewProposal_one_proposed_per_section ON ("reportSectionId") WHERE
"status" = 'proposed'` — Prisma cannot express a partial predicate, so it is
hand-written in the init migration exactly like the ReopenRequest precedent
(`prisma/migrations/20260530162224_init/migration.sql`;
`schema.prisma:623-629`). Confirmed/dismissed rows are unconstrained, so a
section can be re-proposed after a dismiss.

**Surfacing confirmed proposals.** On confirm, the proposal flips to `confirmed`
and the read projection `toReviewViews` **unions confirmed proposals only** as
agent-authored `SectionReviewView` entries (`reviewerName` = a label derived from
`agentModel`, plus the confirmer). Unconfirmed proposals are never unioned, so
inertness holds. This keeps `SectionReview`'s human `reviewerId` FK NOT NULL and
its `@@unique([reportSectionId, reviewerId])` untouched.

**Wire schema (additive, deferred-safe).** `sectionReviewViewSchema` gains
optional `source` (`"human" | "agent"`) and `confirmedByName` fields; a new
`agentReviewProposalViewSchema` and confirm/dismiss input schemas are added.
Optional fields keep existing consumers valid.

## D4. Confirm applies the effect via the existing transition — no new lifecycle

Confirmation MUST NOT invent a second un-submit path. It reuses the verdict
effect already in `ReviewActionsService.verdict` / `postVerdict`
(`review-actions.prisma-repository.ts`), which reuses the head's revoke
transition with the optimistic-lock version guard. The confirm handler:

1. Loads the proposal + its `VerdictContext` (version, status, group, period).
2. Enforces `isDesignatedReviewer(session, groupId, canReviewFlag)` and
   `isEditablePeriod` — the same gates a direct human verdict passes.
3. Rejects if `proposal.judgedVersion !== context.version` (stale — D3 staleness).
4. Applies the verdict effect (`changes_requested` un-submits a still-submitted
   section; `approved` records only) and flips the proposal to `confirmed` with
   `confirmedById` / `confirmedAt` — one transaction.

Because the effect rides the existing human path, the agent gains **no** new
capability: it never touches the transition; a human always pulls the trigger.

## D5. Authz — canonical builder + designation, agent has no session

The confirm/dismiss procedures ride `leadershipProcedure` (head + admin + viewer;
lead excluded — the lead is the data subject), matched by reference identity for
`role-coverage-gate`, with `isDesignatedReviewer` enforced in the service exactly
as `review.verdict` does today. The agent is **not** a role, a session, or a user
principal; it produces a `proposed` row only. There is therefore no code path by
which an agent invokes confirm, un-submit, publish, or a reopen decision — the
"agent-never-bypasses-the-human-lifecycle" invariant is structural, not a runtime
check that could be forgotten.

## D6. Migration / backfill

Additive: one new table, one new enum, one hand-written partial-unique index. No
data backfill — there is no pre-existing agent-proposal data. Under the MVP rule
(`prisma migrate reset` with the consent env var); the hand-written partial index
lands only via `migrate reset`, per DB
(`handedited-init-migration-needs-reset-per-db`). No `SectionReview` row shape
changes, so no risk to existing verdict data.

## D7. Review-mode governs the in-body affordances; the strip is the head roll-up

After HF3 the strip (a roll-up of every section's verdict state) lives on
`/head/dashboard`. That leaves the **in-body** review mode governing the
per-record `RecordComments` composer and the per-section verdict control for
designated reviewers (the viewer-reviewer's only home, D-open-Q-1). The two
capabilities cohere: dashboard = the head's at-a-glance strip; report body =
where a designated reviewer acts on an individual record/section, gated by
review mode.

## Tradeoffs and rejected alternatives

- **Rejected: extend `SectionReview` (Option A).** Cheaper schema, but inertness
  degrades to filter-discipline across three read paths — the exact class of bug
  HF8 exists to prevent.
- **Rejected: fold HF3/HF9 into `agent-review`.** Misfiles live, agent-agnostic
  work under a deferred capability and couples two independently shippable
  slices.
- **Rejected: un-defer the agent invocation now.** Out of scope; the brief asks
  to specify the gate, not build the agent. The invocation stays a loud stub.

## Open questions for a human

1. **Viewer-reviewer verdict home.** This design keeps a designated
   viewer-reviewer able to record verdicts via the in-body review mode (since the
   strip is now head-only). Confirm that is desired, versus giving the strip a
   second, viewer-reachable home. If verdict authority should also narrow to
   head/admin, that is a separate authz decision — note
   `head-lifecycle-authz-expansion-declined` before proposing it.
2. **Schema option A vs B.** Recommendation is B (separate table). A human should
   ratify the extra table + hand-written partial index versus extending
   `SectionReview` with filter-enforced inertness.
3. **Who may confirm.** This design lets any designated reviewer (incl. a
   viewer-reviewer) confirm, matching the direct-verdict gate. If confirming an
   _agent's_ judgement should require stricter authority (head/admin only)
   because it is a lifecycle-affecting action, decide before implementation.
4. **Agent identity model.** `agentModel` is a free string for author
   attribution. If agents must be first-class principals (a seeded synthetic
   `User`, or an `Agent` table) for richer audit/RBAC, that is a larger schema
   decision to settle first.
5. **Approved-verdict downstream effect.** An `approved` human verdict records
   only (no status change). Confirm that a confirmed `approved` agent verdict
   should likewise be record-only, with no auto-advance of any publish step.
