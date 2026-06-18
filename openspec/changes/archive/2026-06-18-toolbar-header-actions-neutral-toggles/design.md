# Design — header-line actions + neutral toggle family

## Layout: two stacked lines, only one is bordered

Row 1 is the existing page `<header>` (no border). Row 2 is the bordered
context bar (`ReportToolbar`). The document actions move up onto Row 1's right
slot; the context bar becomes a single row.

```
LEAD ─ /lead/report
  row1 = page <header> (justify-between, NO border)
    [ My Report · Autosaved ]                 [ (⟲)(⤓) Fill-From  Save  █ Submit Section █ ]
  row2 = ReportToolbar (bordered cream pill, ONE row)
    ⌐Agent review   ‹ Jun 15–21 ›  (⊟)   ‹Mine▓┃Everyone›  ‹Edit▓┃Slides›  (⤢ Toggle All)

HEAD ─ /head/report
  row1   [ Status Report · Live·2/7 · Digital… portfolio review ]   [ (⤓)  █ Publish & Lock █ ]
  row2   ⌐Agent review   ‹ Jun 15–21 ›  (⊟)   ‹Product▓┃Leads›  ‹Edit▓┃Slides›

VIEWER ─ read-only
  row1   [ Status Report · Live·0/7 ]                                [ (⤓) ]
  row2   ⌐Agent review   ‹ Back to Archive ›  ‹ Jun 8–14 ›
```

`▓` = active segment (neutral dark). The header `<header>` already uses
`flex flex-wrap items-center justify-between gap-4` with one left child, so the
document-action group is added as the second child and `justify-between` pushes
it to the right. `flex-wrap` keeps it reachable when the line is narrow.

### Why the header line, not a second bordered row

The user's mental model: the title/status line IS row 1. Putting document
actions there (a) uses space that already exists, (b) removes the second row
from the bordered box so there is no height mismatch, and (c) keeps the green
commit visually attached to "this is the document you are editing", separate
from the quiet view-framing controls below.

## Colour roles (three tiers)

1. **Action — solid brand green.** `--color-starbucks-accent` fill, white text.
   ONLY Submit Section and Publish & Lock. At most one resting solid-green
   control per surface (the forward commit); reversal actions (Request Reopen,
   Revoke, Reopen) and Move-to-archive stay neutral/outline.
2. **Toggle — neutral segmented pill.** Active segment `--color-foreground`
   (rgba(0,0,0,0.87)) fill + white text; inactive segment transparent over a
   solid `--color-surface-empty` (#fafaf7) track, `--color-muted-foreground`
   text, hover → `--color-foreground`. Neutral `--color-border` outline. Green
   is deliberately NOT used here so the toggle never competes with an action.
3. **Quiet utility — neutral.** 32px `ToolbarIconButton` (period nav, Archive,
   document-history icons) and neutral text buttons (Toggle All). Outline/ghost,
   no fill.

### The "yellow" bug

`ViewModeToggle` and `ScopeToggle` set the inactive segment to
`bg-[var(--color-surface)]`. `--color-surface` is undefined in
`packages/ui/src/styles/globals.css` (only `--color-surface-hover`,
`-empty`, `-muted` exist), so it resolves to transparent and the cream toolbar
frame shows through, reading as yellow on the green page. The shared primitive
uses the **defined** `--color-surface-empty` track, removing both the undefined
reference and the tint.

## Component architecture — one look, three mechanics

A shared presentational primitive renders the segmented-pill chrome; each
existing toggle composes it and keeps its own semantics:

- `SegmentedToggle` (new, presentational) — renders an outer pill (neutral
  border, `--color-surface-empty` track, pill radius, `inline-flex`, no extra
  vertical padding beyond the 44px touch target) and a list of segments. A
  segment exposes `{ active, children }` and the active/inactive class logic;
  the consumer supplies the element per segment (`<Link>` or `<button>`).
- `ViewModeToggle` — two `<Link>` segments (`scroll={false}`); slides is a
  separate route. Composes `SegmentedToggle`. **Do not** convert to buttons —
  URL navigation and middle-click/open-in-new-tab must survive.
- `ScopeToggle` — `role="radiogroup"` / `role="radio"` buttons (2–3 segments).
  Composes `SegmentedToggle`.
- `RecordVisibilityToggle` — `aria-pressed` two-state buttons. Composes
  `SegmentedToggle` so Mine/Everyone finally matches Edit/Slides.

Equal width: every segment uses one shared per-segment `min-width` (keep the
existing `min-w-[96px]`, lifted to a named constant the primitive owns) so the
active highlight does not change width as selection moves and the toggles align.

## Accessibility

- The two lines are distinct landmarks/groups: Row 1 is the page `<header>`;
  Row 2 keeps its `role="group" aria-label="Context controls"`. The document
  actions inside the header gain a `role="group" aria-label="Document actions"`
  wrapper so the split is conveyed to assistive tech, not by placement/colour
  alone.
- Focus order: DOM order is header (document actions) before the context bar,
  so keyboard focus traverses document actions before context controls without
  manual tabindex.
- Neutral-dark active fill on the toggle keeps WCAG AA contrast (white on
  rgba(0,0,0,0.87)); inactive text `--color-muted-foreground` on
  `--color-surface-empty` is checked for AA at `text-sm`.
- Icon-only controls keep their `aria-label` + tooltip (no `report-toolbar-parity`
  regression). Labeled actions keep their visible text on the header line.

## Risks / watch-items

- **Head header density.** The head header line already carries title + status
  badge + department label + descriptor. Adding Export + Publish & Lock on the
  right is fine at ≥1088px (the live width) but wraps below; `flex-wrap` handles
  it. If wrapping looks cramped in the live walk, move the department label into
  the context bar's leading edge — flagged, not pre-decided.
- **Neutral-dark active vs slate.** Active fill is `--color-foreground` (near
  black). If it reads too hard in the live walk, swap to a softer slate
  (`#3f4a44`); single-token change, no structural impact.
- **Tests asserting green active toggle.** Existing tests/snapshots that assert
  `--color-starbucks-accent` on the active segment of Edit/Slides or
  Product/Leads must update to the neutral token. Treat as part of the change,
  not a regression to suppress.
