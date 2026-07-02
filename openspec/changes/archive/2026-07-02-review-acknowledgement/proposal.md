## Why

The app has no structured way for anyone but the head to respond to a report, and
the head's only levers are the blunt `Publish & Lock` (whole period) and a bare
per-section revoke. Demo feedback asked for a lighter, non-locking review loop:

- Each group needs **reviewers** who can review any lead's section and leave
  feedback — and the head should be able to do the same inline.
- Feedback must point at the **concrete record** that is wrong, so the lead sees
  exactly where, not a vague whole-report note.
- A reviewer should be able to **send a section back** for rework without locking
  the period — "verdict can un-submit", in-app, now.
- A plain viewer needs an **"Acknowledged"** receipt so the org knows who has seen
  the report.
- The head and viewer want a **submitted-only default view** of the live current
  period, with a toggle to see everything (drafts included).

Today the `viewer` is strictly read-only (ADR 0007) and section un-submit is
head-only (ADR 0008); there is no comment/feedback/acknowledged concept anywhere.

## What Changes

- **Review is a capability, not a role.** Review acts ride the existing
  `leadershipProcedure` (head + admin + viewer; lead excluded) + group scope, with
  an in-handler `canReview` check for the verdict tier. No new enum `Role`, no new
  middleware builder, so `role-coverage-gate` stays green.
- **Acknowledgement** — any head / admin / viewer with group access records a
  group-level "seen" receipt for the period. Surfaced to the head.
- **Per-record comments** — a designated reviewer anchors a comment to a concrete
  `Item` / `Risk` / `Decision`. Flat (no threads). Forward-compatible with a future
  AI review agent author.
- **Per-section verdict** — a designated reviewer marks a lead's section
  `approved` (stays submitted) or `changes_requested`, which **automatically
  un-submits** the section (`submitted → draft`) and returns it in-app to the lead.
  This extends un-submit authority from head-only to designated reviewers
  (ADR 0009); the un-submit path re-checks state under the existing
  `ReportSection.version` optimistic lock.
- **Designation** — a new `ViewerGroupAccess.canReview` flag marks verdict-capable
  viewers; head/admin are reviewers implicitly. Ack needs only access.
- **Submitted-only default view** — on the live current period the head and viewer
  default to seeing only submitted sections, with a toggle to all (drafts
  included). Drafts stay reachable and their presence is signalled, so the head's
  anti-empty-state guarantee (`head-report-visibility`) is preserved. The published
  snapshot is unaffected (ADR 0010).
- Schema: new `ReviewAcknowledgement`, `SectionReview`, `RecordComment` models +
  `ViewerGroupAccess.canReview`. New `review.*` tRPC procedures.

## Capabilities

### New Capabilities

- `review-acknowledgement`: the review capability — group-level acknowledgement,
  designated-reviewer per-record comments and per-section verdict, verdict-driven
  auto-un-submit, and the authorization that carries them on the existing
  leadership chain without a new role.
- `report-submission-visibility`: the head/viewer submitted-only default view of
  the live current period and the toggle to all sections, with the anti-empty-state
  guard.

### Modified Capabilities

- `head-report-visibility`: the head's live draft content is now reachable via the
  submission-state toggle rather than shown by default; submission still never makes
  content unreachable.
- `viewer-report-navigation`: the viewer's live read defaults to submitted sections
  with drafts behind the toggle; the read gate (which periods are authorized) is
  unchanged.

## Impact

- **Schema:** new `ReviewAcknowledgement`, `SectionReview`, `RecordComment` tables +
  `ViewerGroupAccess.canReview`. MVP DBs are disposable — reshape + `migrate reset`.
- **API:** new `review.*` procedures on `leadershipProcedure` with in-handler
  `canReview` + group-scope checks; a transactional, version-checked section
  un-submit reused from the head's revoke path.
- **Web:** ack button, per-record comment affordance, per-section verdict control,
  lead-side in-app surfacing of returned sections + comments, the submitted/all
  toggle.
- **Authz:** un-submit authority widens from head-only to designated reviewers
  (ADR 0009); `role-coverage-gate` unaffected (canonical builders + in-handler
  checks).
- **Docs:** `CONTEXT.md` glossary (Review, Reviewer, Acknowledgement, Verdict,
  Review comment, Submission-state visibility); ADR 0009 + 0010.
- **Out of scope:** AI review agent, comment reply-threads, Telegram/email
  notifications, a per-record verdict, restricting reviewers beyond `canReview`,
  and filtering the published snapshot by submission state.
