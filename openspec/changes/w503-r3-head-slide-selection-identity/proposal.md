# Proposal

## Why

Round-3 acceptance (C5152) reproduced the head deck changing the slide under the
reader without any action. With eight slides and the sixth selected (index 5), a refetch that reorders the review-sorted slides (a risk removed from
another lead's section) kept the same index, so a different lead's slide became
current and its heading changed. The head deck stores the selected position, not
the selected slide, while the existing "clamp an out-of-range selected index"
requirement only covers the lead deck and does not state which slide stays
selected after a content refresh.

## What Changes

- The head slide deck remembers the selected slide by its stable key (slide id and
  page index), not by its position. A refetch that reorders, inserts or removes
  other slides keeps the same slide selected.
- When the selected slide is no longer present, the first slide renders, as
  before. The selection is not rewritten, so the slide is selected again if it
  returns (for example a transient shrink and grow).
- The lead deck keeps its index-based clamp requirement unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-slide-rendering`: adds the head deck selection-identity requirement
  beside the lead deck clamp requirement.

## Impact

- `apps/web/src/features/slides/ui/head-slides-client.tsx`,
  `status-slide-deck.tsx` (export of the existing key helper) and a colocated
  test.

## Non-goals

- No change to the lead deck, slide ordering, pagination or density.
