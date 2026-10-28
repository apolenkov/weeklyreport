# Design

## Overview

Addressing C5350 and C4615 via targeted, minimal fixes adhering to established repository idioms and accessibility patterns.

### C5350: Search Retry Focus Management

When an error occurs during search, `SearchResultsDropdown` renders a `StatusRow` with an action button `Try again`.
When activated via click or Enter key, `onRetry()` is invoked, triggering a query refetch (`isFetching = true`).
Because `isFetching` becomes true, `StatusRow` switches to "Searching…" and the `Try again` button unmounts from the DOM immediately.
In DOM event handling, unmounting an element while it has focus causes `document.activeElement` to fall back to `document.body`.

**Solution**:
Pass `inputRef` (or a focus callback `focusInput: () => void`) into `SearchResultsDropdown` (or pass `onRetry` that focuses the input element directly). Specifically, `SearchField` / `SearchCombobox` can receive a ref or an ID, or `SearchInput` can hold `inputRef = useRef<HTMLInputElement>(null)`. In `SearchInput`:

```ts
const handleRetry = () => {
  inputRef.current?.focus();
  search.retry();
};
```

And on click of `Try again` button, `focusInput()` is called before `onRetry()`, ensuring focus moves explicitly to the combobox `<input>` before the button unmounts.

### C4615: Fill From Dropdown Panel Vertical Clamping

`FillFromDropdownPanel` is portaled to document body with `position: fixed`.
Currently:

```ts
const fillPanelPosition = (rect: DOMRect) =>
  rightAlignedClampedPosition(rect, window.innerWidth, PANEL_WIDTH_PX);
```

Where `rightAlignedClampedPosition` only computes:
`{ top: rect.bottom + ANCHORED_PANEL_GAP_PX, left, width }`.
It does not compute `maxHeight` or flip to `bottom` if there is no room below. Furthermore, `FillFromDropdownPanel` applies:
`style={{ top: pos.top, left: pos.left, width: pos.width }}` without any `maxHeight` or vertical clamping on the container, and inner list only has `max-h-[200px]`. The search input + paddings + list make the container ~268px tall. On a 300px or 200px viewport, `rect.bottom + 4 + 268` exceeds the viewport height!

**Solution**:
In `rightAlignedClampedPosition`, accept `viewportHeight: number` (or compute vertical positioning similar to `use-listbox-panel-behavior.ts`):

```ts
export function rightAlignedClampedPosition(
  rect: Pick<DOMRect, "top" | "bottom" | "right">,
  viewportWidth: number,
  preferredWidth: number,
  viewportHeight?: number,
  preferredMaxHeight: number = 280,
);
```

Or define vertical positioning for anchored panels:
Compute available space below: `roomBelow = Math.max(0, viewportHeight - VIEWPORT_GUTTER_PX - rect.bottom - ANCHORED_PANEL_GAP_PX)`.
Compute available space above: `roomAbove = Math.max(0, rect.top - ANCHORED_PANEL_GAP_PX - VIEWPORT_GUTTER_PX)`.
Determine whether to place above or below, compute `maxHeight = Math.min(preferredMaxHeight, above ? roomAbove : roomBelow)`, `top: above ? undefined : rect.bottom + ANCHORED_PANEL_GAP_PX`, `bottom: above ? viewportHeight - rect.top + ANCHORED_PANEL_GAP_PX : undefined`.
In `FillFromDropdownPanel`:
Apply `style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}` and `flex flex-col overflow-hidden` or `overflow-y-auto` so the panel fits entirely within the viewport.
