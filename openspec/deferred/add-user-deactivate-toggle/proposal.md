# Add user deactivate/activate toggle

## Problem

Admins/heads cannot deactivate or activate users; they must delete them
(irreversible). This is a common request from DeepScan #7 analysis.

## Solution

Add a `isActive` boolean field to the User model. Expose a tRPC procedure
`users.toggleActive(<userId>, <isActive>)` and a UI toggle in all user lists
(dashboard, group members, etc.). Deactivated users cannot log in but retain
their report history.

## Non-goals

- Implement user re-engagement workflows or scheduled reactivation.
- Change group membership during deactivation.

## Impact

Schema change: `ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;`
Touches all user-list UI surfaces.
