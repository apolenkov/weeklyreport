## Context

`openspec/specs` is a flat capability directory. Generated `TBD` Purpose text appears in both product and engineering specs, and there is no durable map from roles/lifecycle to capability names. Activity escalation parity remains intentionally deferred. The viewer authority/header correction is already owned by the concurrent P1 change `sweep15-viewer-authority-labeling`.

## Goals / Non-Goals

**Goals:** create a navigable product map, distinguish product behavior from engineering governance, replace user-facing placeholder purposes, link the already-owned viewer-authority decision, and leave a single deferred trace for activity escalation.

**Non-Goals:** reorganize capability directories, rewrite unrelated requirements, duplicate viewer authority requirements/implementation, or specify/implement activity escalation.

## Decisions

### 1. Add one durable Markdown index under `openspec/specs`

Use `openspec/specs/README.md` as the product-capability index. It has:

1. Product capabilities by role: Shared, Lead, Head, Viewer, Admin.
2. Within each role, lifecycle: Configure → Prepare → Draft → Submit → Review → Publish → Consume/Search → Archive/Reopen.
3. Cross-role capabilities listed once with role tags, not duplicated entries.
4. A separate Engineering governance section for architecture, security, observability, deployment, testing, lint/tooling, and data-integrity capabilities.

Each entry links to `./<capability>/spec.md` and carries a one-sentence purpose. The index is hand-maintained; no generated taxonomy is introduced in this docs-only change.

### 2. Classify by primary user outcome

A capability is Product when its requirements define behavior a role experiences or a product lifecycle rule. It is Engineering governance when it defines implementation architecture, operational quality, deployment, security mechanism, or repository process without a direct role journey. Mixed capabilities go in Product when a user outcome is primary and may be cross-linked from governance notes.

### 3. Replace all user-facing TBD purposes

Inventory every `TBD` Purpose, classify it, and replace all Product placeholders with concrete scope statements derived from their requirement bodies. At minimum:

- `activity-reporting-unit`: activity-parented reporting records/status across lead, slides, head report, and admin configuration.
- `head-report-visibility`: live draft visibility and submission's publish/rollback role.
- `head-dashboard-clarity`: head triage/summary layout and action clarity.
- `review-acknowledge-placement`: acknowledgement placement in the publish flow without becoming a gate.

Engineering TBD purposes may also be corrected when needed for useful index text, but product coverage is the completion gate.

### 4. Viewer authority is linked, not duplicated

The product index classifies and links `viewer-report-navigation`, `viewer-published-search`, and the active `sweep15-viewer-authority-labeling` decision so readers can see that live Status includes drafts while Search remains published-only. This change adds no viewer delta spec, header task, or implementation follow-up.

### 5. Activity escalation gets only a deferred trace

Create `openspec/changes/deferred/activity-escalation-parity/README.md` (or the repo's established deferred trace shape) stating that activity-parented blocked/at-risk escalation remains deferred, linking `status-risk-unification` and the sweep. It contains no active delta spec, design, or implementation tasks and is not included in this change's product requirements.

## Risks / Trade-offs

- [Index drifts] → Keep entries linkable and add a docs check/task comparing capability directories to index entries.
- [Classification debates block progress] → Apply the primary-user-outcome rule and allow cross-links without duplicating ownership.
- [Concurrent viewer scope is duplicated] → Link `sweep15-viewer-authority-labeling` from the index and keep no viewer delta/task here.
- [Deferred trace becomes accidental scope] → No requirements or code tasks; explicitly state reactivation needs a new OpenSpec change.

## Migration Plan

Create the index and classification, replace product Purpose placeholders, link the viewer-authority owner, add/confirm the deferred trace, and validate all specs. No runtime rollout or rollback is required.

## Open Questions

None.
