# Design

## Context

See [proposal](./proposal.md) and [review items 1–7](/home/user/work/handoffs/wr-513/s26/lead-form/p6/REVIEW-1.md). This is a spec-only TASK-707 proposal, not implementation, sync, or archive. The owner decisions override the arena's Move-as-continuation recommendation. The baseline is `99d3651f2`; P1 was read at `ed4c96fae` and P2 at `f931cbd6c`. The archive directory exists but is empty; complete examples were read from Git history (`7d4ad05af`, `6447737ea`) without restoring them.

## Goals / Non-Goals

Make the owner decisions and P1/P2 contracts coherent across existing capabilities, with short normative bodies and testable scenarios. No API, shared schema, Prisma, persisted preference, status vocabulary, or lifecycle change. P6 does not implement UI, claim browser acceptance, or introduce Done plus a new Next item. Existing editor guards and discard/receipt behavior remain.

## Decisions

### 14. One correctable draft-stage default

The stage delta replaces unconditional empty-on-create with a Product/lead-section-draft-scoped eligible stage. Stored edit stages and contextual prefill win; sole-stage auto-application, parent reset, ownership, and deliberate multi-select remain. No memory means empty multi-stage creation; never auto-select all assigned stages. Reject arbitrary stage order, Product-health inference, persisted browser preferences, or overwriting edit stages. Advance, singleton, and draft-lifetime details are resolved below.

### 15. Several create entry points, one composer

Desktop Current/Next cell `+` supplements unit-header Add and seeds that unit/week through one canonical composer. Next creation defaults to editable Planned; existing-item moves do not receive this create-only default. Pointer hover and keyboard focus reveal cell actions; touch controls stay visible.

P5 (`f5b415f88`) collapses empty mobile lanes and uses one `No items in other periods` line per unit, without listing periods. Therefore mobile unit headers own always-visible Current/Next creation controls, including entirely empty units, alongside general Add. Do not attach mobile creation solely to hidden `EmptyLane` or first open Current and require switching to Next. Previous and ineligible records remain read-only.

### 16. Move is postponement, not continuation

For eligible Current work without a separate next commitment, Save changes placement to Next, preserving progress/text/identity and clearing the carried marker. It does not synthesize a Current result, `nextStepText`, or stored `postponed` progress. Collision guards and the existing stored-next-step promotion path remain unchanged. Continue next week remains separate. The old misleading preview scenario is removed with its parent requirement; replacement reading/accessibility and placement requirements retain the unaffected guarantees.

### P1: inline Paused and Clear-and-Done

Paused requests a labelled one-line reason, autofocuses it, and saves valid text on Enter without the full editor. Done with stored next step offers only Clear and mark done or Cancel, focuses confirmation, clears the next step, and saves the same occurrence as done. Required reason and `safeText` remain. Plan is absent; Done plus a new Next item is separate future work, not a cloning/promotion path here.

### P2: autosave recovery and non-overlay completion

The completion group omits permanent manual Save. Autosave error exposes Retry using canonical force-save. The same Retry node survives in-flight work and a 1500 ms Saved flash; it is disabled and `aria-busy=true` while saving, and enabled again on repeated error. On successful removal, only a still-focused Retry transfers focus to enabled Submit or the completion group; focus elsewhere is untouched. This does not remove Save in explicit inline/editor forms.

The rail is a relative layout row **outside and adjacent to** `lead-completion-scrollport`, not inside its scrolling content or a viewport-fixed overlay. The grid reserves content/action space; the rail handles bottom safe area and its own tall overflow. The content scrollport uses toolbar top clearance and 1rem bottom scroll padding. Below 32rem viewport height, normal document flow replaces the constrained full-height layout. Header/rail use the same action contract; the latest header-visibility observation wins. No sentinel/observer leaves header actions usable. P2's loaded non-Overview form disables handoff explicitly; these changes do not impose the Overview grid on every mode.

Rejected: overlay plus guessed bottom spacer; permanent Save/Add rail; independent Submit validators; focus transfer after the user left Retry. Existing role eligibility, review blockers, and creation entry points stay authoritative.

### Data flow

```text
Before: header Add(Current) -> editor -> DraftPatch -> canonical save
        create stage empty/sole; completion manual Save cluster
After:  header/cell Add(unit,week) -> same editor and DraftPatch
        prefill / eligible draft stage / sole / empty
        Paused or Clear-and-Done -> existing status-save boundary
        autosave error -> Retry -> same force-save -> busy/Saved/focus
        scrollport + separate rail -> shared Submit/review state
```

No new server endpoint, schema, lifecycle writer, or read-model store. Defaults and affordances are convenience, never authorization.

## Invariants: preserved, not relaxed

Boundary **I**, applying to every trace row: [explicit eligible Next wins W+1; otherwise unfinished Current continues; one active Next and one target per stable lineage](../../specs/carry-over-automation/spec.md#L9-L76); Previous/published history remains immutable; [periodState and lifecycle tuple stay atomic](../../specs/period-dual-state/spec.md#L18-L33). Canonical auth, Product/Activity XOR, stage ownership, pause reason, risk Impact/Mitigation, and server `safeText` remain enforced. No DB operation is part of P6.

## Requirement traceability (planning only)

Code anchors and implementation-status notes stay here, never in delta scenarios. Baseline anchors below describe owners, not acceptance. Requirement bodies are at most 500 bytes; moved edge conditions remain in scenarios. Removed blocks have explicit migration to their replacement requirements.

### Baseline requirements (`99d3651f2`)

| Capability / requirement                                                                               | Code anchor                                                                                                                                                                                                                                                                                           | Boundary             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| lead-status-overview — Overview MUST edit and create current-period items through the canonical editor | [create](../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L11-L35)                                                                                                                                                                                               | I                    |
| lead-status-overview — Lead report MUST expose an addressable compact Overview                         | [header action](../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L11-L35)                                                                                                                                                                                        | I                    |
| lead-status-overview — Empty temporal cells MUST state their emptiness in plain language               | [desktop dash](../../../apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx#L59-L79), P5 [pinned summary](/home/user/work/handoffs/wr-513/s26/lead-form/p6/p5-reviewed-lineage.tsx#L187-L195)                                                                                    | I                    |
| lead-status-overview — Overview editing MUST preserve context and use the timeline width               | [one host](../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L39-L53)                                                                                                                                                                                             | I                    |
| lead-status-overview — Overview contextual creation MUST seed Current or Next through one composer     | [create seed](../../../apps/web/src/features/report-sections/ui/item-edit-dialog-helpers.ts#L166-L175), P5 [hidden empty lane](/home/user/work/handoffs/wr-513/s26/lead-form/p6/p5-reviewed-lineage.tsx#L43-L63)                                                                                      | I; controls proposed |
| lead-status-overview — Overview previews MUST preserve reading and secondary-action access             | [editor regression](../../../apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.test.tsx#L1703-L1744)                                                                                                                                                                              | I                    |
| record-status-derivation — One stored progress vocabulary independent of week placement                | [placement/progress](../../../apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.ts#L21-L72)                                                                                                                                                                                  | I                    |
| record-status-derivation — Move to next week MUST change placement without asserting continuation      | [save](../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L163-L184), [promotion boundary](../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L287-L300)                                                                                    | I                    |
| risk-stage-integrity — Record creation MUST use an editable Product-stage default from this draft      | [sole-stage helper](../../../apps/web/src/features/report-sections/model/stage-ownership.ts#L6-L15), [Item seed](../../../apps/web/src/features/report-sections/ui/item-edit-draft-store.ts#L43-L60), [Decision seed](../../../apps/web/src/features/period/ui/decision-edit-dialog-model.ts#L70-L87) | I; memory resolved   |
| status-risk-unification — The risk-entry dialog stage multi-select does not default to all stages      | [Risk seed](../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L35-L73), [reset](../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L173-L183)                                                                                                                | I                    |

### P1 reconciliation (`ed4c96fae`, read-only worktree)

| Capability / requirement                                                          | Code/test anchor                                                                                                                                                                                                                                                                                                                                                | Boundary            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| record-status-derivation — Overview Paused and Clear-and-Done MUST resolve inline | [inline controls](../../../../wr707-p1/apps/web/src/features/report-sections/ui/status-overview-status-input.tsx#L20-L90), [reason](../../../../wr707-p1/apps/web/src/features/report-sections/ui/status-overview-reason-row.tsx#L60-L80), [tests](../../../../wr707-p1/apps/web/src/features/report-sections/ui/status-overview-status-flow.test.tsx#L36-L117) | I; no Next creation |

### P2 reconciliation (`f931cbd6c`, read-only worktree)

The named rail implementation retains “sticky” identifiers for compatibility with existing selectors; its geometry is relative, not fixed. These links point only to the read-only P2 worktree, not promised future durable-spec paths.

| Capability / requirement                                                                                            | Code/test anchor                                                                                                                                                                                                                                                       | Boundary |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| lead-completion-guidance — Sticky actions and submission explanation stay separate                                  | [layout](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-layout.tsx#L10-L22), [rail](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-sticky-completion-actions.tsx#L15-L25)                         | I        |
| lead-completion-guidance — Completion layout MUST accommodate safe areas and short viewports                        | [scroll/focus geometry](../../../../wr707-p2/apps/web/src/styles/app.css#L8-L29), [short height](../../../../wr707-p2/apps/web/src/styles/app.css#L80-L90)                                                                                                             | I        |
| lead-plan-verdict — Pending verdicts MUST be counted and MUST block submission                                      | [count and Submit](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-actions.tsx#L63-L94)                                                                                                                                         | I        |
| lead-report-controls-integrity — In-flight control actions show a visible busy state                                | [busy/identity](../../../../wr707-p2/apps/web/src/shared/ui/report-shell/save-now-button.tsx#L105-L171)                                                                                                                                                                | I        |
| lead-report-controls-integrity — Lead completion MUST expose Retry instead of a permanent Save action               | [retryOnly](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-actions.tsx#L58-L62), [Saved flash](../../../../wr707-p2/apps/web/src/shared/ui/report-shell/save-now-button.tsx#L63-L92)                                           | I        |
| lead-report-controls-integrity — Retry removal MUST preserve completion focus without stealing it                   | [focus target](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-actions.tsx#L38-L44), [tests](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-completion-actions.test.tsx#L70-L229)                  | I        |
| report-toolbar-layout — The document-action row uses an accent hierarchy with a single forward primary              | [transient busy style](../../../../wr707-p2/apps/web/src/shared/ui/report-shell/save-now-button.tsx#L53-L58)                                                                                                                                                           | I        |
| report-toolbar-layout — Toolbar row composition adapts to role and period state without losing positional stability | [role/eligibility](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.tsx#L219-L271)                                                                                                                                      | I        |
| report-toolbar-layout — Document actions render on the page header line; the toolbar holds the context-control bar  | [header actions](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.tsx#L241-L271), [rail placement](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview-content.tsx#L261-L309)    | I        |
| report-toolbar-layout — The lead document-action group holds no quick-add control                                   | [header group](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.tsx#L241-L271)                                                                                                                                          | I        |
| report-toolbar-layout — Lead completion handoff MUST share canonical action state                                   | [observer](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/chrome/use-header-actions-visibility.ts#L12-L29), [shared state](../../../../wr707-p2/apps/web/src/features/report-pages/ui/lead/shell/presentation/use-completion-presentation.ts#L39-L64) | I        |

## Risks / Trade-offs

- Stage memory is easy to overreach → package 14 tests must prove advance-on-success, singleton retention, and open-draft lifetime.
- Empty mobile lanes hide create targets → package 15 tests unit-header Current/Next controls and whole-empty units at 375/1280.
- Read-only P1/P2/P5 worktree anchors can drift → commits above identify reviewed sources; coordinator retains evidence before cleanup.
- Syntax is not UI acceptance → P6 runs spec/format/link checks; integration requires independent review, focused tests, all gates, and coordinator browser evidence. In particular Retry focus and keyboard clearance require browser checks, not CSS inspection alone.

## Migration Plan

Commit only this change on `wr707-spec`, no push/sync/archive. Coordinator integrates accepted P1/P2 behavior; packages 14–16 follow the resolved boundaries above. No DB migration, server deployment ordering, or feature flag is needed. Revert a future web package if necessary; P6 itself only changes planning artifacts. Sync/archive after implementation acceptance, retaining external evidence.

## Resolved boundaries for package 14

Resolved for the stage deltas and scenarios in this change: a record Save accepted in this draft advances the remembered stage once it persists; Cancel or a failed Save keeps the previous default. Only a saved single-stage selection counts; multi-select, all-stage selection, and array order never set a default. The memory lives in the open draft, survives an editor remount, and ends on reload or a draft/report change without persistence. Source: p14 DECISIONS-PROPOSAL.
