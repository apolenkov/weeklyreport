## Why

Feedback `cmtmkcxgi00003dw0xod1c64h`, rated 3/5 by the owner, proves that the
compact Overview still falls short as the lead's primary weekly-entry surface.
Long reporting-unit names are visually truncated, Products and Activities lack
strong group boundaries, empty Current/Next cells are dead ends, and SitePing
can place its explicit Send action below the viewport for a tall selected
region.

## What Changes

- Group Product and Project Activity rows explicitly while preserving their
  shared temporal matrix and stable order.
- Keep the full reporting-unit identity visible instead of truncating the only
  identifying label.
- Add a compact `Add update` action to every editable Current week and Next week
  cell, seeded to that Product or Activity and backed by the existing item
  dialog, draft patch, and autosave path.
- Patch the pinned SitePing package at the dependency boundary so popup
  placement uses its rendered dimensions and remains viewport-contained. The
  application still does not inspect or rewrite SitePing's injected DOM.
- Verify the exact owner feedback in a real browser, then delete that feedback
  row as the completion signal requested by the owner.

### Non-goals

- No new report mutation, draft store, item type, persistence, or lifecycle
  transition.
- No editing or creation in Previously planned, submitted, locked, historical,
  or foreign sections.
- No broad report-shell redesign, palette change, or replacement feedback UI.
- No external SitePing repository write or release publication in this change.

## Capabilities

### Modified Capabilities

- `lead-status-overview`: make the matrix a readable quick-entry surface.
- `authenticated-product-feedback`: keep the stock contextual composer fully
  operable inside the viewport through a pinned dependency patch.

## Impact

The change is limited to the Overview projection UI/bridge, focused tests, the
pinned SitePing package patch, and OpenSpec evidence. It adds no database
migration or production configuration.
