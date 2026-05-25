# Add revoke-all button

## Problem

When a head needs to recall all submitted sections in a period (e.g., for a
complete reset before republishing), they must revoke each section one by one —
a manual and tedious operation.

## Solution

Add a "Revoke All" button on the head dashboard (or period view) that revokes
all submitted sections in the current period in one action. Include a
confirmation dialog to prevent accidental bulk revokes.

## Non-goals

- Add filtering (revoke by product, team, or risk level).
- Change individual revoke logic.
- Modify the report submission flow.

## Source

User workflow observation: batch revoke need for period resets (Phase 61+).

## Activation trigger

Activate when the head workflow requires bulk revoke capability or when
period resets become a common operation requiring optimization.
