# Wire agent review

## Problem

Agent (LLM) review surface exists as a stub (`AgentReviewComingSoon` component
in lead and head report views). Phase 60 roadmap includes AI-driven review:
LLM analyzes submitted reports, flags data inconsistencies, and suggests
edits before head approval.

## Solution

1. Mount real `AgentReviewPanel` component in lead and head report surfaces
   (replace ComingSoonBadge).
2. Add backend `ReviewService` with LLM integration (via AI module facade).
3. Add tRPC procedure `generateReview(reportId)` that calls LLM and returns
   findings.
4. Display review findings in UI: list of issues + suggested edits.
5. Gate behind `FEATURE_AGENT_REVIEW` flag for safe rollout.

## Activation trigger

**Phase 60 milestone** — Agent review is a Phase 60 scope item. Activate only
when Phase 60 is unlocked and LLM provider is configured.

## Non-goals

- Implement auto-apply of suggested edits (user must confirm manually).
- Change report submission logic — review is advisory only.

## Status

Deferred — TODO(AGENT-REVIEW-01) in `agent-review-coming-soon.tsx:7`;
TODO(AGENT-REVIEW-02) in `ai-summary.service.ts:78`.
