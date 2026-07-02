# Plan Review Log: review-acknowledgement

Hardened via `grill-with-docs-codex` on 2026-06-30. OpenSpec mode.

## Act 1 — grill with docs (user ↔ Claude)

Interviewed the user one fork at a time; ~8 decisions resolved. `CONTEXT.md`
glossary (Review, Reviewer, Acknowledgement, Verdict, Review comment,
Submission-state visibility) and ADR 0009 + 0010 written inline. The user signed off
on the locked C1 model.

Key forks and outcomes: reviewer = capability, not enum role (Role is single-valued;
head must also review) → rides `leadershipProcedure`. Ack for any access-holder;
verdict/comment for designated reviewers (`ViewerGroupAccess.canReview`). Comments
per-record. Verdict per-section; `changes_requested` auto-un-submits. Submitted-only
default view for head+viewer, scoped to the live period. In-app delivery only.

**Act-1 Codex blind-spot consults — UNAVAILABLE.** Two attempts (junction 1) hung at
0% CPU and were killed by the 600s watchdog (`rc=137`, empty output). A trivial
liveness probe returned fine, so this is request-size / quota throttle on long
repo-reading prompts, not an outage. Per the skill, the consult is advisory and
non-gating — the interview continued. The advisor reviewer covered the blind-spot
role instead.

## Act 2 — adversarial review

**Codex Act-2 review — UNAVAILABLE.** A third attempt (300s watchdog) hung the same
way (`rc=137`, empty). Degraded to the **advisor** reviewer (a stronger model with
full-transcript visibility) as the Act-2 adversarial pass. No Codex `VERDICT` line
was produced; this log does not claim one.

### Advisor findings + responses

1. **[blocked ready-to-implement] Verdict lifecycle on re-submit was undefined** —
   `design.md` said "re-submit is a new round" but `SectionReview` (upsert, unique
   `(section, reviewer)`) had no clearing rule, so a re-submitted section would still
   carry a stale `changes_requested`. **Fixed:** bind the verdict to `judgedVersion`
   (the `ReportSection.version` at verdict time); current only while it matches; a
   re-submit bumps the version so the prior verdict goes stale with no clearing step,
   reusing the optimistic lock. Added a requirement + 2 scenarios, a design
   "Verdict lifecycle" section, the schema field, a read-path task, and a test.
2. **[non-blocking] No head/admin-posts-verdict scenario** — implicit designation
   (head→own group, admin→god-mode) is a different code path from `canReview`.
   **Fixed:** added a scenario + test.
3. **[non-blocking] No resolution marker on persisted comments** — accepted MVP
   default, documented, not built.

### Self-caught earlier in the session (before the advisor pass)

- ADR 0007 collision: submitted-only default reverses 0007's v1 "show drafts" call.
  → scoped the toggle to the live period only; ADR 0010 records the narrow amendment.
- `ReviewAcknowledgement` was keyed per-report, contradicting the group-level
  requirement. → fixed to `(userId, reportId, groupId)`.

## Resolution

Converged. The C1 change validates `--strict` and is **ready to implement**. Codex
was unavailable for both acts (consistent long-prompt hangs); the advisor pass stood
in and its blocking finding is fixed. The user signed off on the model in Act 1;
implementation is a separate step (this skill writes no code, applies/archives
nothing).
