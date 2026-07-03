# Agent-Review Is a Human-Confirmed Gate

> **SCOPE 2026-07-04 — split after grill.** Only the `report-review-mode`
> capability (HF9 review/normal split + HF3 strip relocation, tasks §1) is LIVE
> and being implemented now: it is real walkthrough UX debt, touches no agent,
> and stands alone. The `agent-review` capability (HF7 affordance + HF8
> human-confirmed gate, tasks §2–§6: shared schema, `AgentReviewProposal` table,
> backend confirm/dismiss, web bar) is **PARKED** — it specs an as-yet-unbuilt
> feature (`AgentReviewComingSoon` is still inert) and no production point exists,
> so writing the full inert-proposal contract now risks drift before it is built.
> HF8's principle — _an agent judges, a human always confirms; an agent never
> bypasses the human lifecycle_ — is retained here as the durable guardrail for
> when agent-review is un-deferred. Physically splitting this into two OpenSpec
> changes is deferred to archive-time (both halves are cleanly separated already:
> spec dirs `report-review-mode/` vs `agent-review/`, tasks §1 vs §2–§6).

## Why

The head-surface walkthrough (`docs/feedback/head-surface-walkthrough-2026-07-02.md`,
items HF3/HF7/HF8/HF9) exposes four gaps in the review flow:

- **HF9** — the live report body shows every reviewer affordance (per-record
  comments, verdicts) inline all the time; a head who only wants to _read_ the
  assembled report has no "just read it" mode. The report needs a **review
  mode** (detailed affordances) distinct from a **normal mode** (as before).
- **HF3** — the Section-reviews strip (`section-review-strip.tsx`) renders
  inside the live report body, duplicating a surface the head already scans on
  `/head/dashboard`. Move it onto the dashboard and merge it there.
- **HF7** — the strip should also offer an **Agent-review** affordance so an
  agent can review a section, alongside the human verdict control.
- **HF8** — the load-bearing rule: **whenever an agent review occurs, a human
  MUST confirm it before it affects any downstream action** (un-submitting a
  section, feeding a reopen, changing a badge or a dashboard count). The agent
  _judges_; a human _always_ confirms. An agent must never bypass the human
  lifecycle.

Agent-review is currently an inert `AgentReviewComingSoon` placeholder
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`,
`TODO(AGENT-REVIEW-01)`). This change **specifies** the human-confirmed gate and
the review-mode split so the deferred half can be built to a settled contract; it
does not require un-deferring the agent invocation itself.

## What Changes

- **Review-mode / normal-mode split (LIVE).** The report body gains a review
  mode that surfaces the per-record comment composer and verdict controls, and a
  normal mode that renders read-only report content as before. The always-on
  `AgentReviewComingSoon` header placeholders stay visible in **both** modes, so
  the split never contradicts the deferred-feature-pattern coverage requirement.
- **Relocate the Section-reviews strip to the head dashboard (LIVE).** The strip
  moves onto `/head/dashboard`, merged into the dashboard's review area, and is
  no longer rendered inside the live report body. Because the strip is head-only,
  the in-report review mode carries the per-section verdict control for
  designated reviewers, so a viewer-reviewer is not stranded.
- **Agent-review affordance on the strip (DEFERRED).** The strip presents an
  Agent-review control rendered as an inert `AgentReviewComingSoon`
  (`ComingSoonBadge`), per the deferred-feature convention — no runtime flag.
- **Human-confirmed gate (SPECCED, agent half DEFERRED).** An agent review is
  recorded as an inert **proposal** that has _no_ downstream effect — no
  un-submit, not `isCurrent`, absent from the section badge, absent from
  submission-dashboard counts, cannot feed a reopen — until a **designated human
  reviewer** confirms it. Confirmation applies the verdict's effect, preserving
  agent authorship plus the human confirmer for the audit trail. A stale proposal
  (the lead re-submitted after the agent judged) cannot be confirmed.
- **Deferred backend stubs.** The agent-invocation procedure (and, until built,
  confirm/dismiss) throw the loud `Not implemented — see TODO(AGENT-REVIEW-01)`
  stub, matching the existing deferred-feature-pattern backend requirement.

## Capabilities

### New Capabilities

- `report-review-mode` — the report-body review-mode/normal-mode split (HF9) and
  the relocation of the Section-reviews strip onto the head dashboard (HF3). Live.
- `agent-review` — the Agent-review strip affordance (HF7) and the
  human-confirmed gate that keeps an agent review inert until a designated human
  confirms it (HF8). Specced; the agent-invocation half is deferred.

### Modified Capabilities

<!-- none — see design.md "Zero MODIFIED deltas" for the deliberate skip
     rationale: deferred-feature-pattern, reopen-requests, and role-coverage-gate
     are all REINFORCED by this change, none turns contradictory. -->

## Impact

- **Specs:** two new capabilities under `openspec/specs/` on archive.
- **Schema (`prisma/schema.prisma`):** a new `AgentReviewProposal` table +
  `AgentReviewProposalStatus` enum, plus a partial-unique index (at most one
  `proposed` row per section — ReopenRequest precedent). Additive only; no
  backfill (no pre-existing agent data). Under MVP, reshape + `migrate reset`.
- **Shared (`packages/shared/src/schemas/review.schema.ts`):** additive proposal
  view + confirm/dismiss input schemas; `sectionReviewViewSchema` gains optional
  agent-attribution fields (wire-only, deferred-safe).
- **Backend (`apps/api/src/modules/review/`):** proposal repository/service; the
  confirm/dismiss procedures ride `leadershipProcedure` + `isDesignatedReviewer`;
  the agent-invocation entry point throws the loud stub. The read projection
  `toReviewViews` (`report-sections.prisma-repository.ts`) unions **confirmed**
  proposals only.
- **Web (`apps/web/src/components/weekly-report/review/`,
  `apps/web/src/components/dashboard/`):** review-mode/normal-mode toggle; strip
  relocated to `dashboard-page.tsx`; in-report verdict control for designated
  reviewers; Agent-review `ComingSoon` affordance; confirm/dismiss bar.
- **Load-bearing invariants preserved:** `role-coverage-gate` (new procedures use
  canonical builders) and **agent-never-bypasses-the-human-lifecycle**.
- No change to the period dual-state write path (the un-submit is section-level).
- Breaking: no. Deferred agent invocation ships behind the existing ComingSoon.
