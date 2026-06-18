# Plan Review Log: toolbar-two-row-document-vs-context

Act 1 (grill-with-docs) complete — plan locked, CONTEXT.md glossary updated
(Document action / Context control), taxonomy layout in design.md. MAX_ROUNDS=5.

## Round 1 — Codex

VERDICT: REVISE. 12 findings (spec conflicts: head-toolbar-semantics accent on toggle active-state; lead-report-controls-integrity Save busy green; report-toolbar-parity header-row labels; head Archive filter-vs-move ambiguity; viewer/preview inheritance overclaim; read-only vs deferred-feature inert controls; missing reserved-slot/empty-publish/a11y/responsive scenarios; tasks trace gaps; wrong publish-lock-button path).

### Claude's response (round 1)

Accepted all 12 findings (all confirmed against durable specs):

- Colour: exempted segmented-control active-state + Save busy from the single-primary/no-accent rule (R2.3/R2.4).
- Added MODIFIED delta to report-toolbar-parity (labeled actions keep text after row move; Submit Report→Submit Section).
- Split head archive: show-archived filter = context row; Move-to-archive = document action top row (R1.3 + scenario).
- Softened viewer/preview inheritance to the shared-toolbar API; Back-to-Archive + AgentReview = bottom row (R4.3).
- Read-only: hide only real mutating actions, keep inert Coming-soon stubs (R4.1) — reconciles deferred-feature-pattern.
- Added scenarios: reserved inert slots, empty head publish; added a11y group-label + focus-order requirement; added narrow-width reachability requirement.
- Expanded tasks (move-to-archive, viewer nav, lead preview, Save busy, parity delta, a11y, responsive).
- Fixed paths (publish-lock-button/export-pdf-button under weekly-report/).

## Round 2 — Codex

VERDICT: REVISE. 5 findings: (1) head-toolbar-semantics still locates toggles/placeholder in header; (2) lead show-archived must be conditional on archived periods existing; (3) tasks 2.5/2.6 read-only contradiction; (4) viewer/preview bottom-row MUST overreached onto lead-preview outer header; (5) parity delta iconification rule muddy.

### Claude's response (round 2)

Accepted all 5:

- Added MODIFIED delta for head-toolbar-semantics (toggles + AgentReview placeholder relocate to Context row; visual-family/accent-active + ComingSoon rules preserved, location-agnostic).
- Made lead show-archived conditional (only when archived periods exist) + added no-archived scenario.
- Fixed tasks 2.5 (single read-only rule: hide real actions, keep stubs); added 2.6 conditional show-archived.
- Scoped R4.3 bottom-row placement to VIEWER only; lead-preview outer header declared outside the shared toolbar contract.
- Reworded parity delta to a by-control-kind rule: ToolbarIconButton for compact icon-only; named commit/utility keep text inside ReportToolbar.

## Round 3 — Codex

VERDICT: REVISE. 4 consistency findings: (1) 'exactly one primary' false in reversal-only states; (2) proposal responsive out-of-scope contradicts in-scope reachability; (3) design table/task list show-archived unconditional vs conditional spec; (4) head 'Publish on one control' wording still header-framed.

### Claude's response (round 3)

Accepted all 4:

- R2 reworded to 'at most one resting solid primary'; no-forward-commit states have no solid primary.
- Proposal out-of-scope bullet: full breakpoint redesign out, narrow-width reachability in scope.
- design table + task 2.1 mark Show-archived as conditional (when archived periods exist).
- Added MODIFIED delta: 'Publish on exactly one head control' regardless of header vs document-action row.

## Round 4 — Codex

VERDICT: APPROVED. Prior findings addressed; no remaining material spec conflicts, untraced tasks, or code-assumption blockers. Minor proposal wording roughness noted (bottom-row 'uniform neutral grey' vs the active-toggle exception).

### Claude's response (round 4)

Polished the proposal bottom-row wording to name the active-toggle + Save-busy accent exceptions. Converged at 4 rounds.
