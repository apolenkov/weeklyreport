# Fix head dashboard to respect group membership

## Problem

The head dashboard displays all users in the system, ignoring the head's
assigned group. Heads should only see users in their own group(s), not
cross-group users.

## Solution

Refactor the users API query to filter by `currentUser.groupIds` when the
caller is a head. The tRPC procedure already carries `ctx.user.role`; we add
a check: if `role === "head"`, apply a `WHERE group_id IN (...)` filter at
the database layer.

## Non-goals

- Change admin behavior (admins remain unrestricted).
- Add group-switching UI for heads (heads use a fixed group assignment).
- Alter the group creation or assignment flow.
