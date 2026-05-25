# Add revoke action on head dashboard

## Problem

The Revoke action (recall a submitted report section) is available only inside
the lead-authored section view. On the head's report dashboard grid, there is no
per-row Revoke button, forcing the head to navigate into each section to revoke
it — inefficient for bulk operations.

## Solution

Add a per-row Revoke action button on the head dashboard (lead-reports-grid or
blocked-at-risk-table). The button triggers the same revoke logic as the
in-section view and updates the status pill to reflect "Draft" state.

## Non-goals

- Add a "Revoke All" batch operation (separate change).
- Change revoke confirmation flow or permissions.
- Modify the section data model.

## Source

User report: "Revoke есть только в просмотре секции, на дашборде нет."
Phase 61+ head UX improvement.

## Activation trigger

(Active — improving head workflow efficiency.)
