## MODIFIED Requirements

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder MUST render visually subordinate to real actions — compact — and MUST lead its control group: the head report header, or the right-aligned view-control group of the report toolbar's context bar.

Today this placeholder is `AgentReviewComingSoon`
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`). The inert
ComingSoonBadge pattern (aria-disabled, no click handler, tooltip) MUST be
preserved. In the report toolbar's context bar the controls form two clusters —
period navigation (and the show-archived filter) anchored left, and the
right-aligned view-control group (Agent review, scope, view mode, expand-all)
pushed right by a spacer. The placeholder is compact and leads that right-aligned
view-control group; it is NOT required to be the first element of the whole bar
(the period navigator is).

#### Scenario: the context bar renders a deferred placeholder

- **WHEN** the report toolbar's context bar renders the Agent review placeholder
  alongside the right-aligned view controls (scope, view mode)
- **THEN** the placeholder is compact (smaller than the real actions) and is the
  first element of the right-aligned view-control group, following the
  left-anchored period navigation
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip
