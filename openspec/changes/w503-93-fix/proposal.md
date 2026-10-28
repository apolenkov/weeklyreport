# Change: Crawler hit testing and visibility in batch presses

## Why

In `scripts/ui-crawl/batch.ts`, the `covered()` predicate previously only checked a clamped center point of an element using `document.elementFromPoint`.
This led to two categories of defects (TASK-503.93 / C4113):

1. Zero-area, clipped (overflow), translated offscreen, or scaled to zero controls resulted in `covered() === false` and were incorrectly sent to `press()`. Instead, invisible or unreachable controls must not be pressed and must yield a distinct result (`invisible`).
2. Overlays with `opacity: 0` (or `visibility: hidden` / `pointer-events: none` transparent overlays) returned `covered() === true`, incorrectly reporting the target control as obstructed.

## What Changes

- Update `scripts/ui-crawl/batch.ts`:
  - Enhance the check in `batchScript` before pressing an element:
    - Check if the element or any ancestor is invisible (`display: none`, `visibility: hidden`, `opacity: 0`, `hidden`, or collapsed `details`).
    - Check if the element has zero area (`width <= 0 || height <= 0`), or zero intersection with the visible viewport.
    - Check if the element is clipped away by `overflow: hidden/clip` ancestors.
    - If the control is not visible or unreachable in the viewport, record it with `status: 'invisible'` instead of pressing it.
    - In hit-testing (`covered`), ignore elements that have `opacity: 0` or `pointer-events: none` as obstructing elements (by looking deeper through `elementsFromPoint` or skipping transparent overlays).
  - Update `PressResult` type definition to include `status: "ok" | "gone" | "obstructed" | "stale" | "invisible"`.
  - Update `finishPress` and `recoveredPress` in `scripts/ui-crawl/press.ts` to handle `status: "invisible"`.
- Add test coverage in `scripts/ui-crawl/batch.browser.test.ts` to verify zero-area, clipped, translated offscreen, scale(0), and opacity:0 overlay behaviors.

## Capabilities

### New Capabilities

- Batch press runner distinguishes between actually obstructed controls, gone controls, stale controls, and invisible/unreachable controls (`invisible`).
- Batch press runner does not treat `opacity: 0` overlays as obstructing clickable controls beneath them.

### Modified Capabilities

- `batch.ts`: `batchScript` hit-testing and visibility predicates.
- `press.ts`: `finishPress` and `recoveredPress` handle the `invisible` status.
