# Proposal

## Why

Verification of TASK-503.87 identified two regressions/defects on Stand C (chunk 7):

1. **C5350**: In `/reports` search, clicking or pressing Enter on "Try again" after an error leaves focus on `document.body` because the retry button unmounts when `isFetching` becomes true ("Searching…"). Focus must remain on a meaningful target (the search input combobox) instead of dropping to `<body>`.
2. **C4615**: The "Fill From" dropdown panel (`aria-label="Past reports"`) overflows below the viewport on low-height screens (e.g. 1280×300 by 92px, 1280×200 by 192px) because it has no vertical clamping, no `maxHeight`, and no `bottom` coordinate constraint when rendered below or above the trigger.

## What Changes

1. **Search Retry Focus Restoration (C5350)**:
   - In `SearchResultsDropdown`, when "Try again" is clicked or activated, or in `SearchInput` when `retry` is triggered, ensure focus is restored to the search combobox (`inputId`) so focus does not drop to `<body>` upon unmounting the action button.
2. **Fill From Panel Viewport Clamping (C4615)**:
   - In `use-fill-from-dropdown.ts` and `fill-from-dropdown-panel.tsx` (or `use-anchored-panel-position.ts`), calculate and apply vertical bounds (`top` or `bottom`, and `maxHeight`) to ensure the portaled panel never overflows below the viewport on low/zoomed viewport heights.

## Capabilities

### Modified Capabilities

- `dialog-listbox-a11y`: Search retry action preserves keyboard/pointer focus on the search combobox when the error retry row is dismissed/unmounted.
- `period-fill-from-ui`: The Fill From past reports panel clamps within viewport height boundaries so its contents remain scrollable and accessible on low viewports.

## Impact

- `apps/web/src/shared/ui/search/search-input.tsx` & `search-results-dropdown.tsx`
- `apps/web/src/features/period/ui/fill-from-dropdown-panel.tsx` & `use-fill-from-dropdown.ts` / `use-anchored-panel-position.ts`
- Unit tests colocated with both features.

## Non-goals

- Altering the debounce, caching, or query logic of search.
- Altering the period selection or copy confirmation workflows of Fill From.
