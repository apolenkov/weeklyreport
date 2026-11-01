# Design: Lead plan item direct manipulation

Owner decision 01.11; mockup variant D
(https://example.invalid/private-review, viewable only in a
signed-in Claude session — the decision brief is the authoritative summary).

## Context

The Lead Report Overview (`/lead/report/:reportId`) renders three columns:
Previously planned / Current week / Next week. Today a week move goes through
the overflow menu ("Move to next week" applies `buildMoveItemPatch` directly
since the in-flight change `lead-status-overview-direct-move`, TASK-766;
"Move to this week" still opens the canonical editor), and any text change
opens the canonical item editor. The owner wants board-like direct
manipulation: in-place text editing, card drag between the two active weeks,
hover icons (week move, ✎ edit, + comment), and Undo after a move.

## Decisions

### DnD library: `@dnd-kit/core` (recommended)

- **`@dnd-kit/core`** — React-first, actively maintained, ships pointer and
  touch sensors with activation constraints (a movement threshold so a tap or
  text click is not misread as a drag start), a keyboard sensor, and an
  `aria-live` announcements API that fits the a11y contract in the delta
  spec. Three fixed droppable columns with small item counts need no
  virtualization, which is the library's main gap. `@dnd-kit/sortable` is not
  needed: columns are drop containers, not sortable lists.
- **`pragmatic-drag-and-drop`** — excellent zero-dependency touch drag, but a
  vanilla-JS API: we would hand-roll the React binding, activation
  constraints, and accessibility announcements. Rejected: more code for the
  same surface.
- **Native HTML5 DnD** — no dependency, but desktop-only (no reliable touch),
  no keyboard support, limited drag-image and event model, and extra a11y
  work. Rejected.

### One shared move handler for drag, icons, and keyboard

All three entry points call the same handler: build the placement-only move
patch (existing `buildMoveItemPatch` semantics for Current→Next; a symmetric
builder for Next→Current), apply it to the draft engine, and let the
canonical autosave persist it. The move preserves stored progress, text, and
`stableId`, clears `carriedOver`, and is rejected when the target week
already holds an active occurrence for the same `stableId` (rollover
invariant: at most one active W+1 per `stableId`). A Current item with a
saved `nextStepText` follows the existing acknowledgement handling from
`record-status-derivation` (no second Next is created, no promotion). A
rejected move animates the card back to its column and writes nothing.

### Keyboard move

The card is a focusable unit (Tab stop) with an accessible name. On
`keydown` with Alt held: `Alt+ArrowRight` moves a focused Current card to
Next; `Alt+ArrowLeft` moves a focused Next card to Current; every other
combination, including any direction from or toward Previously planned, is a
no-op. Focus follows the moved card. `@dnd-kit`'s keyboard sensor stays
disabled: the documented shortcut is an explicit handler, so the contract
remains testable without library coupling.

### Inline text editor

Clicking the item's description text replaces it with a textarea in place
(same position, auto-height). State machine: `editing → saved | cancelled`.

- Enter: save if the trimmed text is non-empty, else cancel
- Esc: cancel; previous text restored
- Shift+Enter: insert a line break, stay editing
- pointer down outside the field: save if non-empty, else cancel

Saving reuses the description-only `DraftPatch` through the existing
autosave path: no new tRPC procedure, and no change to `periodState` or the
report lifecycle tuple (the existing atomic lifecycle writers are referenced
only, per the load-bearing convention).

### Hover icon cluster

Per editable item, revealed on pointer hover and keyboard focus within the
item, always visible on touch: the applicable week-move icon (→ for Current
items, ← for Next items), ✎, +. ←/→ activate the shared move handler; ✎
opens the canonical item editor (same target as the overflow "Edit
details"); + opens the existing record comment flow
(`record-comment-save-coordination`). Accessible names state the item and
the target, e.g. "Move <text> to next week".

### Undo

The move confirmation notification carries an Undo action (time-bounded,
like other toasts). Undo is the same move handler with the reverse direction
on the same occurrence — not a server-side undo endpoint and not draft
history. If the occurrence no longer sits in the moved week, or the reverse
patch is rejected, the notification reports the failure and the server state
stands. No Undo for inline text edits (non-goal).

### Two-tab races

No new server logic. The draft save already carries the optimistic section
version, so a stale save is rejected server-side. The losing tab reverts the
affected card to the last server state, announces the standard save-failure
error, and re-synchronizes the Overview from the server's section. The
tab never retries implicitly; the lead may re-issue the move manually. The
server stays the single source of truth, and the at-most-one-active-W+1-per-
`stableId` invariant holds because every committed move passes the same
guarded patch builder.

## Data flow

Before:

```
overflow `…` → "Move to next week" → buildMoveItemPatch → draft.apply
→ autosave → saveSection (existing atomic periodState + lifecycle writers)
```

After (new entry points, same pipe):

```
drag drop | icon tap | Alt+Arrow → shared move handler
  → placement-only DraftPatch (Current→Next | Next→Current)
  → draft.apply → autosave → saveSection (unchanged)

click on text → inline editor → description-only DraftPatch
  → autosave → saveSection (unchanged)
```

No new procedure, middleware, or schema write.

## Invariants

- **Preserved**: rollover "at most one active W+1 per `stableId`"
  (`carry-over-automation`, `item-progress-lifecycle`); atomic `periodState`
  - lifecycle tuple (`Report_lifecycle_tuple_check`); Previously planned
    read-only; the seven canonical tRPC middleware builders (no new
    procedure); in-week ordering by durable `stableId`
    (`report-record-ordering`).
- **Mutated (UI affordance only)**: `lead-status-overview-actions` — the
  "no duplicate standalone quick week-move button" prohibition is superseded
  by the dedicated week-move icon (MODIFIED requirement, full text in the
  delta).
- **Relaxed**: none.

## Risks

- Drag vs scroll/tap ambiguity on narrow layouts and touch: activation
  constraint (small movement threshold) plus long-press drag start on touch;
  verified in the e2e scenario with agent-browser.
- Focus management after a move: focus must follow the card and screen
  readers must hear it — covered by delta scenarios.
- Undo staleness window (item edited or moved again): explicit refusal
  scenario; no data loss by construction, since Undo only issues an ordinary
  move.
- `@dnd-kit` compatibility with React 19 / React Compiler in this app: pin
  the latest stable and smoke-test the Overview before feature work (task 0).
- Drag-based e2e steps can be flaky: the e2e covers a real drag for browser
  evidence but automates the icon and keyboard paths as the stable
  regression.

## Rollout

No schema migration and no feature flag; the feature ships when the six
local gates plus the e2e scenario are green (see `tasks.md`). Downstream
consumers are the Overview feature in `apps/web` only; `apps/api` changes
are limited to accepting the two placement-only move directions and the
description-only patch through the existing `saveSection` path. The
overflow-menu move paths (`lead-status-overview-direct-move`) are untouched.
