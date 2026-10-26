# Design

## Shared ownership boundary

The shared provider owns the single visible tooltip. Each `useSdlcTooltip`
instance receives a stable identity, which the provider stores alongside the
visible content. The hook's public `show(rect, content)` and `hide()` API stays
unchanged; its private context calls carry that identity.

`hide()` and effect cleanup clear state only if the requesting identity owns it.
A previous anchor's delayed mouseleave or unmount must not hide a newer anchor's
tooltip. Global scroll/resize dismissal still clears the visible tooltip.

The shared hook owns unmount cleanup so slide rows, author badges and lock badges
cannot drift into different lifecycle implementations. Stable callbacks keep
ordinary rerenders from triggering cleanup. Provider absence remains a no-op.

## Alternatives

Per-consumer unconditional cleanup would hide unrelated tooltips. A boolean
recording whether an anchor has ever hovered cannot identify the current owner
once another anchor replaces it. DOM observers and positioning changes are not
needed to implement React consumer unmount cleanup and remain outside this fix.

## Verification boundary

Use the preserved C5180 and C5298 consumer tests plus previous-owner handoff
regressions against real `LockBadge` components. Prove failures on unchanged
product source before applying the fix. Native public list removal, first paint,
layout shifts, AT and carousel geometry remain Waiting; jsdom is not evidence of
those outcomes. Parent integration owns full gates and independent review.
