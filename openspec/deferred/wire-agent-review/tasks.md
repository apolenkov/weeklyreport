# Tasks

## Backend service + frontend integration

- **AGENT-T1** Implement `ReviewService` with LLM integration via AI module
  facade; define review finding schema (issue type, severity, text, line ref)
- **AGENT-T2** Add tRPC procedure `generateReview(reportId)` with
  `@UseGuards(RoleBasedAccessGuard)` guard
- **AGENT-T3** Replace `AgentReviewComingSoon` in lead report view with real
  `AgentReviewPanel` component (display findings)
- **AGENT-T4** Replace `AgentReviewComingSoon` in head report view;
  optionally allow head to re-trigger review
- **AGENT-T5** Add `FEATURE_AGENT_REVIEW` flag to `.env`; gate
  `generateReview` call behind flag
- **AGENT-T6** Integration test: verify review findings returned, findings
  displayed in UI, feature flag gates access
- **AGENT-T7** Commit: `feat(ai): wire real agent review service (Phase 60)`

## Verification

```bash
FEATURE_AGENT_REVIEW=true \
pnpm --filter @customreport/api test -- \
  src/modules/ai/__tests__/agent-review.test.ts
pnpm --filter @customreport/web typecheck
```
