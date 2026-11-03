# Design: contextual quick entry in the Lead Overview

## Intent and decisions

A Lead works within an existing Product or Activity and a three-week report. Keep the established paper visual system and timeline. Place one quiet add action per editable unit in each of Current and Next, including an empty unit. The chosen lane fixes the week and the unit fixes its parent. Input begins inline; the pencil continues to open the canonical detailed editor. The separate global toolbar creation flows remain available.

Provide similarly compact inline risk and decision entry in the relevant unit context. Risks and decisions belong to the report section and parent rather than to an invented weekly item lane. Present the actual required fields before submission: risk, impact, mitigation and severity; decision, impact and server-derived/author-derived owner. Product stage choice follows owned eligible stages; Activity has no Product stages. Invalid or incomplete input stays in the editor and is not represented as saved.

A prior commitment is immutable historical input. Its existing Done, Continue, Next week, Paused and Won't do actions write the selected week's occurrence or the existing outcome command, never the prior snapshot. Reuse stable identity, existing rollover precedence, conflict handling and undo; identical text alone is not an identity conflict. Directional buttons and existing keyboard shortcuts provide quick movement without requiring drag.

The comment icon opens a labelled read-only comments region with its actual authorized comments or an explicit empty state. It does not invent a Lead reply endpoint: existing `review.comment` forbids Lead writes. The owner was asked whether replies are desired; absent a reply, the current permission boundary is retained. If the owner later requests replies, revise this design and spec before implementing server authorization and lifecycle rules.

## Alternatives

Putting a modal behind each week button would preserve much of the current code but fails the requested in-grid input. A separate standalone quick-entry store or new write API would duplicate existing draft and concurrency ownership. The selected approach uses the current projection, canonical validated record builders, draft coordinator and save receipts, with small contextual presentation components.

## Boundaries and data flow

1. `report-sections` Overview renders labelled unit/week actions and compact presentation. It passes an explicit existing unit kind/id and Current/Next target; no Previous creation. On mobile, preserve unit and period labels, 44px targets, touch-visible controls and no page overflow.
2. The Lead shell owns one mutually exclusive contextual editor state and all writes. Item creation reuses `useOverviewCreateOpeners`, `saveOverviewItem`, the submission driver, generation and focus/recovery machinery. Detailed edit remains the modal. New inline input participates in existing pending-input, leave and discard guards.
3. Contextual risk/decision presentation produces a valid `RiskEntry`/`DecisionEntry` through existing domain builders; no changes are made to foreign rows. The shell applies a patch against the latest **own** list and waits for a record-specific, generation-scoped persistence receipt before reporting success. A generic last-saved timestamp is not proof that the intended record survived filtering. Keep a stable submitted ID across retries; disable duplicate submissions while pending.
4. Validation, save failure, offline, conflict, lost capability, target or stage changes and unmount/navigation must not discard typed input or silently overwrite newer data. Dirty cancel asks before discard. If a failed save already applied a draft patch, restore/remove that patch and wait for it to be observable before issuing a save. A stale result cannot clear a newer input. Server authorization and the atomic report lifecycle remain authoritative.
5. The comment presentation consumes only the existing authorized `item.comments`; it opens a named region, exposes an empty state and focus return, and must not fetch foreign/private data. A viewing affordance must not falsely imply a writable composer.

## Ownership and sequencing

Shell/controller and receipt integration are a single-writer responsibility. Timeline placement, compact record-form components and the comment control can be produced in separate work packages against explicit interfaces; shared barrel and prop wiring are integrated by the shell owner after candidates are reviewed. No worker edits another owner's files or the active owner-preview worktree. The separate design, guideline and UX inputs are archived under `/home/user/work/handoffs/task-836/`.

## Verification

Focused tests must first demonstrate failures for contextual week/owner entry, required fields and stage changes, comment empty state, stale/failed persistence, dirty discard and prior-plan identity. Verify exact saved identity on a matching receipt, no duplicates on retry, preservation of other own rows, no foreign leakage, and unchanged prior snapshot. Exercise existing full editor, toolbar, verdict, move, roles and lifecycle. Run the six root gates, strict OpenSpec validation, appropriate guarded database integration and full E2E where the write contract requires it. Inspect the implemented source in a separate browser session at 1280 and 375 with keyboard, focus, empty/error/pending states and screenshots; do not reset or change the owner's current inspection data.
