# Proposal

## Why

Leads plan their week on the Lead Report Overview (Previously planned /
Current week / Next week). Today, moving an item between Current and Next
means opening the overflow menu or the full item editor, and fixing a single
word means opening the canonical editor and saving it. Owner decision 01.11
(mockup variant D,
https://example.invalid/private-review — viewable only in a
signed-in Claude session; the decision brief is the authoritative summary)
asks for board-like direct manipulation: edit the item text in place, drag
the card to the other active week, reach move / edit / comment from hover
icons, and undo a move from the confirmation.

## What Changes

- In-place text editing: clicking the text of an editable Current/Next item
  opens an inline editor; Enter saves, Esc cancels, Shift+Enter adds a line
  break, a click outside saves, and empty text is not saved (previous text
  is restored).
- Drag and drop between the Current and Next columns. Previously planned is
  neither a source nor a target.
- A hover icon cluster per item (always visible on touch): week-move icon
  (→ for Current items, ← for Next items), ✎ edit (canonical editor),
  - comment (existing flow); `Alt+ArrowLeft` / `Alt+ArrowRight` move the
    focused card.
- The move confirmation offers Undo, implemented as a reverse move through
  the same draft save path.
- Two-tab races: the server draft save stays the source of truth; a
  rejected move reverts the card and re-synchronizes the Overview.
- Conflicts with, and therefore MODIFIES in full, "Overview MUST expose one
  primary progress interaction per active item" in
  `openspec/specs/lead-status-overview-actions/spec.md` — its hover scenario
  currently asserts "no duplicate standalone quick week-move button is
  rendered", which the dedicated week-move icon supersedes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview-actions`: one requirement modified (week-move
  affordance), seven requirements added (inline edit, drag and drop,
  icons/keyboard, Undo, Previous read-only, two-tab convergence, touch).

## Impact

- `apps/web` Overview feature only; new UI dependency `@dnd-kit/core`
  (recommendation; alternatives in `design.md`).
- No new tRPC procedure, schema, or middleware change. Moves and text edits
  ride the existing canonical draft and autosave path (`saveSection`);
  `periodState` and the report lifecycle tuple stay the existing atomic
  writers' responsibility and are referenced, not changed.
- Sibling contracts referenced, not changed: `record-status-derivation`
  (placement-or-acknowledgement move), `item-progress-lifecycle` and
  `carry-over-automation` (at most one active W+1 per `stableId`),
  `report-record-ordering` (no in-week reordering),
  `record-comment-save-coordination` (+ icon flow). The in-flight change
  `lead-status-overview-direct-move` (overflow menu path) is untouched.

Non-goals:

- No move to or from Previously planned in either direction.
- No Undo for inline text edits (no draft history mechanism).
- No in-week reordering (order stays per `report-record-ordering`).
- No multi-item drag, no head/viewer surface changes, no feature flag.
