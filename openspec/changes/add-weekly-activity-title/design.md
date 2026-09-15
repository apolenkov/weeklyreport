## Context

See proposal.md. ActivityStatus belongs to ReportSection and Activity; its existing note is already persisted and projected. The parent ACT-01 trace identifies omission/null behavior and snapshot consumers. The user explicitly chose weekly title and description, not catalogue rename or note-only scope.

## Goals / Non-Goals

Add only a nullable title override; reuse note for description. Do not duplicate details storage, create a second save pipeline or share overrides between leads.

## Decisions

Before: catalogue name → ActivityStatus read projection; note → draft payload → section save → report projection.

After: ActivityStatus.titleOverride + catalogue name → effective live title; titleOverride and note → existing canonical draft/save; publication freezes effective title and note → Viewer/slides/PDF.

- Store titleOverride on ActivityStatus. Effective draft title is a nonblank override or the catalogue name. Trim input, use the existing catalogue-name maximum from the shared schema, and reuse note's existing limit. Omitted fields preserve values; explicit null or blank input resets that field. UI labels distinguish weekly fields from catalogue identity.
- A new week's row starts with no override and no note, matching existing initialization. Ordinary carry-over and fill-from must not acquire implicit copying of these fields. Another lead/week never changes through a local edit.
- The published representation carries the resolved title, not a live catalogue lookup. Existing snapshots keep their stored label and note; absent new override metadata does not trigger a live-label fallback.
- Route title/note changes through the same section version check and draft retry behavior as other Activity fields. Server authorization remains tied to the owning editable section.

## Allowed implementation scope

Start with prisma/schema.prisma and the existing init migration; shared report-section input/read/snapshot schemas; report-persistence mapper/snapshot assembly; report-section-merge and save-section.derive; ActivityStatusSection, LeadActivityCard, lead-form-draft-patch/merge helpers, lead-form-draft-actions and lead-form-bridge-accordions. Resolve exact paths from the parent source trace before claiming a packet; tests stay beside their owners. No other module ownership is implied.

## Risks / Trade-offs

- Live catalogue rename changes a draft fallback → publication freezes the resolved value; test old snapshots independently.
- Save deletes/recreates status rows → preserve omitted override/note and section-version conflict behavior.
- Shared Overview/quick-edit files are concurrently dirty → serialize overlapping ownership and preserve pre-existing edits.

## Migration Plan

Update schema and the canonical init migration together, following repository policy. No migration/reset runs are authorized by this plan. Prove fresh creation only on an explicitly authorized guarded disposable target; if unavailable, record unavailable integration evidence. Generate the client, update readers/writers together, then validate snapshots and UI. Do not use an additive second migration contrary to the current MVP convention. Rollback preserves records and published snapshots; destructive rollback needs separate authority. Period dual-state, seven role builders and destructive guards are unchanged.
