## Context

See `proposal.md`. The dirty worktree contains a complete but rejected linked-continuation surface: `StatusOverviewItemPreview` owns item actions, `LinkedContinuationTarget` and its drag handle own separate next-step editing, and `StatusOverviewAdditionalUpdates` renders independent Current and Next lists side by side. The clarified model has an immutable prior-plan snapshot plus one editable occurrence placed in Current or Next; a period transition requires confirmation before a Next plan becomes a confirmed Current update.

## Goals / Non-Goals

**Goals:**

- One obvious Add/Edit workflow for a low-digital-literacy lead.
- Explicit Current/Next planning while preserving lineage, history, permissions, conflicts and autosave recovery.
- Stable row/card geometry across desktop and narrow viewports.
- A minimum coherent diff that extends the existing canonical editor and write path.
- One consistent interaction grammar across every form and lifecycle state reachable from the Lead route.

**Non-Goals:**

- A new persistence model, mutation endpoint, drag ordering, priority deletion or report lifecycle change.
- Head, Reviewer, and Admin UX changes.
- Shipping unrelated dirty API, cache, Activity-title, observability or seed work.

## Decisions

### 1. Keep technical lineage, remove it from basic authoring language

The UI uses `Item`, `Current week`, `Next week`, `Edit`, `Move to this week`, and `Move to next week`. It does not present `next step`, `continuation`, `linked`, or `standalone` as things the author must manage. The active occurrence moves between Current and Next; the prior snapshot remains read-only. Existing continuation fields may be read for compatibility but the new authoring path does not create a second commitment.

Alternative rejected: renaming `Add next step` while retaining its separate form. The user has rejected the workflow itself, not its label.

### 2. One canonical editor and one item action rail

Item title and visible `Edit` open the same canonical editor. The editor owns text, one active-week placement, status and required Product/Activity fields. `Move…` actions preselect the other week while retaining all values. A prior-only lineage exposes `Plan this work`, which seeds this editor from the authoritative predecessor, mints a new active record, and preserves the predecessor `stableId`; it never edits the prior snapshot. Audited Done/Won't-do and Restore actions remain available in one secondary overflow instead of competing with Edit and Move. Confirm remains a direct contextual action for carried Current work. Save/Cancel remain explicit; conflicts and retry retain input. Priority controls are absent, but the patch preserves existing `priorityRank`.

Alternative rejected: multiple quick editors plus icon actions. They make capability discovery and state ownership ambiguous.

### 3. Render stable lineage rows; do not zip independent lists

Linked period representations share one row. Independent Current or Next items receive separate rows/cards and never align by array index. Desktop keeps period columns for scanning; mobile uses one card per logical item with labelled week sections.

### 4. DnD is progressive enhancement only

If retained, a drag handle moves eligible work to an explicit Current or Next target by opening the same editor. It never saves, sorts, or changes status by itself. Repeated instructional paragraphs are removed. Labelled menu actions provide full keyboard/touch parity. If browser testing shows DnD adds confusion after the text is removed, delete the affordance without changing the canonical flow.

### 5. Reuse current write contracts unless tracing proves a gap

Before: item/drag action → separate continuation editor → continuation/promotion handler → canonical draft or mutation.

After: Add/Edit/Move/Plan this work/drag → canonical item editor with exactly one selected active week → existing DraftPatch/outcome coordinator → autosave/version checks → refreshed projection. Prior-only Done/Won't-do → existing audited outcome command. Period opening → carried-plan candidate → explicit lead confirmation → confirmed Current occurrence.

No new Prisma field is planned. Existing `carriedOver` is the durable unconfirmed marker only while an occurrence is Current: automatic carry sets it, confirmation clears it, and an explicit move to Next clears it before the next carry. The implementation may extend the existing lead-authorized write contract rather than create an unrelated endpoint. Current and Next accept the same stored progress vocabulary so an explicit placement change never rewrites progress; `pausedReason` and risk-derived alarms retain their existing invariants. The existing database CHECK and shared validation must be updated together if tracing confirms they encode the rejected per-week vocabulary. Period dual-state is untouched because these writes modify section children only. Existing `leadProcedure` chains remain unchanged. No destructive database operation is required.

The implemented move and confirmation path reuses the existing command exactly:
`buildMoveItemPatch` / `buildConfirmCarriedItemPatch` emit `DraftPatch { kind: "item-patch" }` → `applyDraftPatch` → `patchDraftItem` → `useLeadFormDraftCore.apply` → `sectionToDraftPayload` → autosave `LeadFormWritePort.saveDraft` → `reports.saveDraft` → `ReportSectionsService.saveDraft` → `mergeSection` → `ReportSectionsPrismaRepository.saveSection` → `applySaveSection`. The server-owned section lookup, author check, period/section lifecycle gate, published-lineage guard and optimistic version compare-and-set therefore remain the authorization/conflict boundary. `stableId` is the durable lineage identity; the save transaction re-anchors reviewer comments by that identity after its existing child-row rewrite, while published snapshots are outside this live-draft write path. The only demonstrated persistence gap was the per-week status restriction: shared `CURRENT_ITEM_STATUSES` / `NEXT_ITEM_STATUSES`, the canonical init CHECK for fresh installs, and forward-only migration `20260914223000_item_week_status_independence` for already-migrated databases accept `planned`, `in_progress`, `paused`, `postponed`, and `done` for either week. The already-deployed `20260904203000_item_next_commitment` migration remains historical. No endpoint, Prisma field, destructive database action, reset, or reseed was added.

The existing Status Overview projection continues to select one lane from `item.type`; it now exposes `needsConfirmation` only on the actual Current occurrence when `carriedOver` is true. Read-only projections retain the marker for truthful display, while edit authority remains represented by the existing nullable `editTarget`.

Legacy Current records that contain both result text and `nextStepText` use the existing audited outcome write rather than the generic draft patch: `outcomes.promote({ target: "next" })` → `LeadFormWritePort.promotePlan` → `leadForm.promotePlan` → `LeadFormService.promotePlan` → `LeadFormPrismaRepository.promotePlan` → `promotePlanTx` → `promoteItemTransition`. The transaction updates the same `stableId` occurrence to Next, makes the prior `nextStepText` its active text, preserves `workflowStatus` and `pausedReason`, clears `nextStepText` and `carriedOver`, and appends a `plan_next` outcome event whose `beforeState` retains the old Current text and commitment. Authorization, lifecycle locking, optimistic version compare-and-set and target-aware command replay remain in the existing coordinator. A cancelled editor or failed transaction performs none of those writes, so both legacy texts remain intact.

An explicit outcome transaction clears `carriedOver` atomically with its audit event, so cancelling carried work cannot leave submit permanently blocked. For records already persisted as both cancelled and carried, the ordinary-save resolution guard permits only the one-way marker recovery `true → false`; parent, text, status, priority, pause, commitment, stages, resolution and deletion remain locked until Restore plan.

## Risks / Trade-offs

- [Hiding next-step language could obscure distinct weekly text] → show each authoritative weekly text in its labelled period cell and preserve History on demand.
- [A generic week selector could permit invalid transitions] → derive available targets and statuses from existing eligibility helpers and enforce the same rule server-side.
- [Priority can be lost by replacement-style patches] → add a regression proving unrelated Overview edits retain `priorityRank`.
- [DnD remains visually ambiguous] → omit it from mobile, keep labelled actions primary, and remove DnD entirely if browser acceptance fails.
- [Existing carry-over excludes Next items still marked carriedOver and resets status] → clear the marker on explicit Next planning, preserve status in the clone, and prove A→B→C behavior.
- [Legacy Current text and nextStepText contain two valid texts] → reject the generic in-place Move patch and require the existing outcome/history path to resolve which text remains authoritative; never clear either value silently.
- [Dirty-tree coupling can contaminate delivery] → assign Sol exact owned files, use a temporary index/tree check, and have independent review the immutable staged diff.

## Reconciliation with earlier deltas

This change is the active superseding delta for Status Overview authoring. It supersedes the user-facing interaction requirements in `clarify-status-overview-workflow` and `preserve-linked-continuation-dnd` where they require a separate linked Next commitment, `Add/Edit next step`, `Start next step now`, or preservation of Current as an active occurrence while creating Next. The earlier changes' task checklists, receipts, screenshots, and implementation evidence are historical records and remain unchanged.

The active model is one editable occurrence per stable lineage in exactly one of Current or Next. Move actions open the canonical editor and change only placement unless the lead explicitly edits another field. Existing continuation, promotion, history, comment, conflict, and persistence paths remain compatibility paths for legacy data where required; they do not create additional Status Overview entry points.

Stable identity, immutable prior snapshots, comments/history, optimistic conflicts, read-only gates, and no-reorder guarantees remain authoritative where compatible. Independent Current and Next work remains separate by row/card, but the UI does not require the author to understand `standalone`, `linked`, or `continuation` concepts.

## Migration Plan

1. Update tests and presentation on top of the current in-flight Overview work without destructive data changes.
2. Remove obsolete separate-continuation UI only after all callers route to the canonical editor.
3. Validate focused tests, a selected-tree build, full repository gates where applicable, and real browser states.
4. Roll back only this change's UI/spec patch; retained persistence fields and historical data require no rollback.

## Lead authoring inventory

The finite Lead denominator excludes Slides internals, Preview internals, and all Head, Reviewer, and Admin routes.

| Section or form              | Entry and actions                                          | States                                                             | Canonical handler                                          | Focused evidence                                            |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Route and shell              | Report/Slides, period navigation, Retry                    | loading, unavailable, error, ready, past/read-only                 | `LeadForm`, `useLeadFormEditor`, required reads            | page, addressable, load-error, skeleton and lifecycle tests |
| Status Overview              | Add/Edit, Move, Confirm, Resolve prior plan, history       | prior/current/next, saving, recovery, conflict, read-only          | overview item editor, plan actions, canonical `DraftPatch` | status-overview and lead-status-overview tests              |
| Open work                    | Resume, Continue, Replan, Reopen                           | loading, retry, completed/cancelled disclosure, unavailable editor | `useOpenWorkRegister`                                      | open-work-register model/hook/UI tests                      |
| Product status               | own stage status                                           | own, foreign, empty, risk-covered, locked                          | sync bridge and status-risk sync                           | sync-bridge, pipeline and stage-chip tests                  |
| Activity status              | status, weekly title, description, reset title             | editable, read-only, covering-risk floor                           | sync bridge and draft actions                              | activity-status-section tests                               |
| Current and Next item boards | Add/Edit/Delete; explicit Move; Pause/Complete where valid | Product/Activity, own/foreign, draft/submitted/past                | item dialog and editable-list handlers                     | current/next section, item-card and item-dialog tests       |
| Risks and Blockers           | Add/Edit/Delete, severity                                  | validation, missing parent, covered status, read-only              | risk dialog and risk-list editing                          | risks-section and risk-dialog tests                         |
| Decisions                    | Add/Edit/Delete                                            | validation, deadline, parent/stage, read-only                      | decision dialog and decision change handler                | decisions-section and decision-dialog tests                 |
| Fill From                    | choose prior report, Replace and Fill                      | search, dirty confirmation, pending, error/reload                  | `useLeadFormFillFrom`, `leadForm.fillFrom`                 | fill-from button/hook/toolbar tests                         |
| Quick Add                    | Current item, Next item, Blocker, Risk, Decision           | enabled/disabled by parent and lifecycle                           | quick-add signals and Lead dialogs                         | quick-add and Lead dialog tests                             |
| Save and recovery            | Save now, Retry                                            | idle, pending, saving, saved, error, conflict, unload guard        | Lead autosave and server sync                              | autosave, reconciliation and unload tests                   |
| Submit                       | Submit report, confirm                                     | ready, incomplete, submitting, unconfirmed carry, error            | Lead write actions and readiness                           | completion, readiness and Lead form tests                   |
| Revoke or request reopen     | Revoke, Send request, Cancel                               | submitted, pending, error, retry, unauthorized                     | revoke and reopen-request hooks                            | revoke and request-reopen dialog tests                      |
| Returned feedback            | read-only grouped feedback                                 | empty or grouped Item/Risk/Decision feedback                       | feedback mapper and view                                   | feedback and mapper tests                                   |

The existing duplicates to remove or consolidate are: three Submit placements; repeated Save and Quick Add chrome; item Add actions in toolbar, section, column and Activity lane; Overview quick-edit, continuation, drag and outcome actions competing for one item; Activity title/description editors in two surfaces; and priority/next-step fields in basic item editors. Removal is permitted only when the remaining path preserves the same authorized user outcome.

## Reticle scenario order

Automate the smallest persistence/lifecycle set first. Variants in one row are parameters, not separate scripts.

| Priority | Reusable flow                     | Required consequence                                                         |
| -------- | --------------------------------- | ---------------------------------------------------------------------------- |
| P0       | Product/Activity Item Add or Edit | one successful save, reload equality, Cancel/no-write, exact cleanup         |
| P0       | Canonical Move Current ↔ Next     | same `stableId` and status, one active occurrence, save 200, reload, cleanup |
| P0       | Carried confirmation              | exact blocker focus, Confirm save, marker absent after reload, cleanup       |
| P0       | Submit                            | draft becomes submitted/read-only after reload, exact lifecycle cleanup      |
| P0       | Fill From                         | replacement matches selected source after reload, exact target restore       |
| P0       | Risk/Blocker/Decision Add or Edit | save/reload equality, applicable health projection, cleanup                  |
| P0       | Request Reopen                    | one pending request after reload, duplicate action hidden, cleanup           |
| P1       | Activity weekly fields            | explicit Save/Reset/Cancel, reload equality, dirty navigation guard          |
| P1       | Legacy dual-text Move             | history retained and pause/status preserved after reload                     |
| P1       | Save failure and retry            | editor input retained, no duplicate write, successful retry reloads          |
| P1       | Version conflict                  | conflict visible and local input retained                                    |
| P1       | Returned feedback                 | grouped comments readable and editing re-enabled only after return           |
| P1       | Read-only variants                | submitted/foreign/locked states expose no mutating controls                  |
| P2       | Responsive/accessibility sweep    | desktop, mobile and real 200% zoom; focus, 44px targets and no overflow      |

The remaining broad inventory is covered by parameter data for these flows. Add a new saved flow only when it exercises a different write path or lifecycle consequence.
