## 1. Capability inventory and classification

- [x] 1.1 Inventory every `openspec/specs/*/spec.md`, its current Purpose, primary role(s), lifecycle stage, and Product versus Engineering governance classification.
- [x] 1.2 Apply the primary-user-outcome rule to mixed capabilities, record one canonical owner entry, and identify cross-role tags/cross-links without duplicating ownership.

## 2. Durable product-capability index

- [x] 2.1 Create `openspec/specs/README.md` with Shared, Lead, Head, Viewer, and Admin sections organized by Configure, Prepare, Draft, Submit, Review, Publish, Consume/Search, and Archive/Reopen as applicable.
- [x] 2.2 Add one linked entry and concrete one-sentence purpose for every Product capability, listing multi-role capabilities once with role tags.
- [x] 2.3 Add a separate Engineering governance section for architecture, security, observability, deployment, data integrity, testing, lint/tooling, and repository process capabilities.
- [x] 2.4 Add a docs verification check or deterministic command that reports unindexed capability directories and broken relative spec links.

## 3. Purpose and authority corrections

- [x] 3.1 Replace the `activity-reporting-unit` Purpose with its activity-parented records/status and cross-surface scope.
- [x] 3.2 Replace the `head-report-visibility`, `head-dashboard-clarity`, and `review-acknowledge-placement` Purposes with concrete live-visibility, triage/action, and publish-flow scope.
- [x] 3.3 Replace every remaining Product-classified `TBD` Purpose found by the inventory; leave no generated archive/sync placeholder in a user-facing capability.
- [x] 3.4 Link/classify `viewer-report-navigation`, `viewer-published-search`, and `sweep15-viewer-authority-labeling` so the chosen live-Status/published-Search authority model is discoverable without duplicating its delta or code tasks.

## 4. Deferred trace and docs verification

- [x] 4.1 Add/confirm the deferred activity-escalation-parity trace links the sweep and `status-risk-unification`, states the asymmetry is intentional, and contains no active requirements or implementation tasks.
- [x] 4.2 Search Product specs for `TBD`, verify zero hits, and manually follow every index link.
- [x] 4.3 Run `openspec validate --specs --strict` and fix every structural or semantic documentation error.

## 5. Repository gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`
