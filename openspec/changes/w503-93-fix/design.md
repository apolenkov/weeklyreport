# Design: Crawler hit testing and visibility in batch presses

## Context

The UI crawler executes batches of actions in the browser via `batchScript` in `scripts/ui-crawl/batch.ts`.
Prior to dispatching a synthetic press on a control, `batchScript` calls `covered(el)`.
Currently:

```js
const covered = (el) => {
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(
    Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)),
    Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2)),
  );
  return (
    !!top &&
    top !== el &&
    !el.contains(top) &&
    !top.contains(el) &&
    top.closest("label")?.control !== el
  );
};
```

If `covered(el)` is false, it proceeds directly to `press(el)`.
However:

1. Zero-area controls (`width: 0`, `height: 0`, or `scale(0)`):
   `getBoundingClientRect()` has zero width/height. Clamping center point to viewport edges tests an arbitrary boundary pixel, which usually returns `document.body` or `<html>`, or if outside, doesn't match `el`. But if it returns `el`'s parent or something containing `el`, `top.contains(el)` is true, so `covered(el)` returns false! The crawler then attempts to click a 0-size or invisible element.
2. Clipped / translated offscreen controls:
   Controls translated offscreen or hidden in an overflow:hidden container have no visible intersection with the viewport. Center point clamped to `(0, 0)` or `(innerWidth - 1, innerHeight - 1)` tests an unrelated element at the edge of the screen, or fails containment checks inconsistently.
3. Overlays with `opacity: 0`:
   `document.elementFromPoint` returns the topmost element even if its computed `opacity` is `0` or `pointer-events: none`. When an invisible modal overlay or tooltip wrapper with `opacity: 0` sits over a control, `document.elementFromPoint` returns the overlay, causing `covered(el)` to return `true` (false obstruction).

## Approach

1. Visibility / Reachability check before hit testing:
   Define `visible(el)` inside `batchScript`:
   - Checks `getBoundingClientRect()`. If `r.width <= 0 || r.height <= 0`, it's zero-area (not visible/unreachable).
   - Check computed style on `el` and ancestor chain:
     - `display === 'none'`, `visibility === 'hidden'`, `opacity === '0'`, `transform` resulting in scale(0), or element has `hidden` attribute.
     - Details element that is not open and does not contain `el` in its summary.
   - Check viewport intersection:
     `left = Math.max(0, r.left)`, `right = Math.min(innerWidth, r.right)`,
     `top = Math.max(0, r.top)`, `bottom = Math.min(innerHeight, r.bottom)`.
     If `left >= right || top >= bottom`, it has zero intersection with the viewport (translated offscreen, scrolled out, etc.).
   - Check overflow clipping:
     Walk parent elements with `overflow: hidden`, `overflow: clip`, `overflow-x: hidden`, etc., and ensure `el`'s bounding box intersects with the parent's bounding box.
   - If not visible/unreachable: return `{ ...base, status: 'invisible', reason: 'control is invisible or unreachable' }`.
   - In `scripts/ui-crawl/press.ts`, handle `status === 'invisible'` as an error/skipped step without dispatching synthetic clicks.

2. Hit testing (`covered` predicate):
   When checking whether `el` is covered:
   - Find candidate top elements using `document.elementsFromPoint((left + right) / 2, (top + bottom) / 2)`.
   - Filter candidate stack for elements that actually block clicks:
     - Ignore elements where computed style `opacity === '0'`, `pointer-events === 'none'`, or `visibility === 'hidden'`.
   - The first non-transparent, interactive element is the effective `top`.
   - If effective `top` exists and is not `el`, `!el.contains(top)`, `!top.contains(el)`, and not a label for `el`, then `el` is obstructed.
