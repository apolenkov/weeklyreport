# Add head period-bar parity

## Problem

The lead form has a consistent period navigation bar (arrows to move between
weeks/periods) at the top. The head dashboard lacks the same navigation
affordance, requiring the head to use browser back/forward or a separate
navigation menu — inconsistent UX.

## Solution

Add the same period navigation bar to the head report view, with the same
styling and interaction as the lead form bar. Ensure it syncs with the current
period context.

## Non-goals

- Add new period filtering or grouping.
- Change the lead period-bar behavior.
- Add period creation/deletion.

## Source

User observation: "для хеда была точно такая же полоска для периодов, как у
лида." Phase 61+ UX consistency.

## Activation trigger

Activate when head period navigation becomes a blocker or when UX consistency
audit flags the gap.
