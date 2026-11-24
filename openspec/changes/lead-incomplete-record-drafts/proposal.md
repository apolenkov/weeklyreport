# Proposal

## Why

Leads need to capture risks and decisions quickly without inventing missing details or losing unsaved text. TASK-836's quick-entry proposal currently requires complete records before saving; durable partial capture requires a cross-layer contract.

## What Changes

- **BREAKING:** split nullable author-draft contracts from strict submission/publication; require completion or explicit deletion before section submission.
- Preserve incomplete records across replacement saves, including legacy clients; retain concurrency, identity and authorization protections.
- Exclude incomplete records before reviewer-facing status and publication projections, with scoped omission disclosure, while retaining private author recovery.
- Keep publication eligibility, complete records and immutable historical snapshots compatible.

## Capabilities

### New Capabilities

- `lead-incomplete-record-drafts`: minimum capture, completeness and shared omission vocabulary.
- `lead-retained-incomplete-records`: private retained-source recovery and explicit validated copy.

### Modified Capabilities

- `lead-section-draft-payload`: include valid incomplete drafts.
- `report-section-write-gates`: authoritative completeness and omission-safe replacement.
- `report-record-ordering`: preserve published decision completeness and distinguish lineage permission from incomplete deletion intent.
- `fill-from-write-lock`: exclude incomplete source rows, preserve target drafts and provide private author recovery discovery.
- `record-comment-save-coordination`: deny nonauthor writes on currently incomplete risk/decision anchors, including existing comment deletion.
- `record-status-derivation`: complete-risk alarms and escalations.
- `status-risk-unification`: complete-risk floors and nullable entry details.
- `publish-compare-and-set`: serialize exclusion and disclosure with publication.
- `published-portfolio-snapshot`: filter before portfolio derivation.
- `viewer-report-navigation`: scoped live and frozen disclosure.
- `lead-form-cross-author-scope`: exclude private incomplete content from foreign reads.
- `authorized-report-retrieval`: complete candidates and scoped corpus notice.
- `search-contract-precision`: live SQL exclusion and independent omission response.
- `viewer-published-search`: indexed frozen omission disclosure.
- `analytics-query-correctness`: winning-snapshot omission metadata.
- `pdf-export-integrity`: job-bound scoped printed disclosure.
- `carry-over-automation`: exclude incomplete decisions from both sources.

## Non-goals

No automatic rollover of incomplete records, invented content, new reopen rights, publication-history store or retention guarantees. Current active authoring-role entitlement and exact section authorship govern private text and retained discovery across every own-read route; unrelated complete-history access remains unchanged.

## Impact

Shared schemas, Prisma migrations, section transactions, projections, search response contracts, snapshots, carry-over, PDF and Lead UI. No new dependency. TASK-836 evidence: `handoffs/task-836/quick-draft-options.md` and `quick-draft-review.md`; source inventory and rollout in `design.md`. Coordinated with `../lead-week-grid-quick-entry/`, whose contextual-entry contract now depends on this change rather than full-before-save.
