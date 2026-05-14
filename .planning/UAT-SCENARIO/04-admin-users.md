# 04-admin-users — UAT Scenarios

**Route:** `/admin?tab=users`
**Role:** admin / head

Users management tab. Covers add/edit/delete operations, activation/deactivation with session revocation (A2), search filtering, and empty state handling.

## Administrative Operations

### ADM-USERS-01 — Users table renders all users

**Element:** `data-testid="users-table"` | table
**Route:** `/admin?tab=users`
**Role:** admin

Steps:

1. Navigate to `/admin?tab=users` and log in as admin.
2. Observe the table header (Name, Email, Role, Group, Actions).
3. Verify rows for all active and inactive users are visible.

Expected: Table displays all users with full name, email, role badge, and group assignment. Inactive users show "inactive" badge.
Edge cases:

- Empty users list → "No users match the search" message displayed instead of table rows.
- Inactive user row → opacity-60 styling, "inactive" badge visible.

Status: `[ ]`

### ADM-USERS-02 — Add User dialog opens

**Element:** Add User button | dialog `data-testid="crud-sheet"`
**Route:** `/admin?tab=users`
**Role:** admin

Steps:

1. Click "Add User" button.
2. Observe dialog with form fields.

Expected: Dialog with title "Add User", input fields for name, email, role select, group select, action buttons (Cancel, Add User). Escape closes without saving.
Edge cases:

- No active groups → Group select disabled with "No active groups configured".

Status: `[ ]`

### ADM-USERS-03 — Add User form validates required fields

**Element:** `id="user-name"` | input
**State precondition:** Add User dialog open

Steps:

1. Leave Name + Email empty.
2. Click "Add User" (disabled until groupId is set).

Expected: Submit disabled when groupId is empty. Form accepts submission once required fields filled.

Status: `[ ]`

### ADM-USERS-04 — Edit User dialog prefills form

**Element:** Edit button (row action)
**State precondition:** users table populated

Steps:

1. Click Edit on a user row.
2. Observe form prefilled with name, email, role, groupId.
3. Modify email, click "Save Changes".

Expected: Dialog opens prefilled. Changes persist. Toast "User saved".
Edge cases:

- Editing user with archived group → archived group shown with "(archived)" label, selectable.

Status: `[ ]`

### ADM-USERS-05 — Role change persists via saveUser mutation

**Element:** `id="user-role"` | select
**State precondition:** edit dialog open

Steps:

1. Change Role from "lead" → "admin".
2. Save Changes, reopen.

Expected: Role shows "admin" on reopen. Admin cache invalidated. Toast confirms.

Status: `[ ]`

### ADM-USERS-06 — Deactivate User immediate session revocation (A2)

**Element:** Deactivate button (when user.isActive=true)

Steps:

1. Click Deactivate on active user.
2. Confirm toast "User deactivated".
3. Verify row shows "inactive" badge.

Expected: isActive→false in Prisma. Redis revocation set updated (sessionRevocationService.revokeSession). In-flight JWT rejected. Button → "Activate" green.
Edge cases:

- Mutation pending → cursor-not-allowed, opacity-50.
- In-flight JWT at deactivate time → next API call rejected via context factory Redis check.

Status: `[ ]`

### ADM-USERS-07 — Deactivated user cannot login

**Route:** login attempt with deactivated user

Steps:

1. As admin, deactivate user X.
2. Log out.
3. Attempt login as user X.

Expected: Login rejected. Error indicates account is inactive.
Edge cases:

- Valid JWT issued before deactivation → next API call rejects via Redis revocation check.

Status: `[ ]`

### ADM-USERS-08 — Activate User restores session eligibility

**Element:** Activate button (when user.isActive=false)

Steps:

1. Click Activate on inactive user.
2. Confirm toast "User activated".
3. Verify "inactive" badge removed.

Expected: isActive→true. Redis revocation cleared. New login succeeds. Button → "Deactivate" amber.

Status: `[ ]`

### ADM-USERS-09 — Delete User shows confirmation dialog

**Element:** Delete button (row action)

Steps:

1. Click Delete on user row.
2. Observe alertdialog "Delete User?" with user name.

Expected: Modal `role="alertdialog"`, `aria-modal=true`. Buttons: Cancel, Delete.
Edge cases:

- Cancel → deleteTarget=null, no mutation.
- Click outside alertdialog → does not close (modal).

Status: `[ ]`

### ADM-USERS-10 — Delete User confirms and removes record

Steps:

1. Click Delete in confirmation dialog.
2. Wait, observe toast "User deleted".

Expected: deleteUserMut called. User deleted from Prisma. Cache invalidated.
Edge cases:

- FK constraint failure → API error, toast displays error.

Status: `[ ]`

## Search and Filtering

### ADM-USERS-11 — Search filters users by name, email, role, department

**Element:** `data-testid="users-search"` | input

Steps:

1. Type "alice" → filters to Alice.
2. Clear, type "admin" → all admin-role users.
3. Type "alice@example" → email substring match.

Expected: Real-time filtering via useMemo(filteredUsers). Case-insensitive. Matches across name/email/role/department.
Edge cases:

- Leading/trailing spaces → trimmed.
- Empty search → all users.
- Special chars → literal includes().

Status: `[ ]`

### ADM-USERS-12 — Search with no matches displays empty state

Steps:

1. Type string matching no users ("zzzzz").

Expected: Table hidden, empty-state "No users match the search." with border-dashed, bg-surface-empty.

Status: `[ ]`

### ADM-USERS-13 — Search is case-insensitive

Steps:

1. Type "ALICE" uppercase.
2. Type "aLiCe" mixed case.

Expected: Both match Alice. Lowercase normalization.

Status: `[ ]`

## User Management Edge Cases

### ADM-USERS-14 — Add User form disabled during save (isPending)

Steps:

1. Click "Add User".
2. Verify button disabled, text "Saving…".

Expected: During saveUserMut.isPending: Cancel + Add User disabled, cursor-not-allowed, opacity-50.

Status: `[ ]`

### ADM-USERS-15 — Escape key closes Add/Edit dialog without saving

Steps:

1. Type into Name field.
2. Press Escape.
3. Reopen dialog.

Expected: Escape → showDialog=false. Form state reset on reopen.

Status: `[ ]`

### ADM-USERS-16 — Click outside Add/Edit dialog closes without saving

Steps:

1. Fill form.
2. Click overlay backdrop.

Expected: onClick on `role="presentation"` overlay → setShowDialog(false). e.stopPropagation() inside dialog prevents closing.

Status: `[ ]`

### ADM-USERS-17 — Inactive user badge displays correctly

**Element:** badge span with `aria-label="Inactive user"`

Expected: When isActive=false, "inactive" badge with gray-200 bg, gray-500 text. Row opacity-60.

Status: `[ ]`

### ADM-USERS-18 — Deactivate button styling reflects state

Expected: Active row Deactivate: amber-600 text, white bg. Inactive row Activate: starbucks-accent text, hover bg success.

Status: `[ ]`

### ADM-USERS-19 — Empty users list shows no table

Expected: When users=[], filteredUsers=[]. Table not rendered. Empty-state shown.

Status: `[ ]`

### ADM-USERS-20 — Tab header displays user count

**Element:** TabHeader component

Expected: title="Users", description="Manage group members and their roles.", count="{users.length} users".

Status: `[ ]`

## Integration and Data Persistence

### ADM-USERS-21 — New user appears in table immediately after add

Steps:

1. Fill Add User form, submit.
2. Wait for dialog close.

Expected: saveUserMut → trpc.admin.saveUser. invalidateAdmin → refetch. New user visible.
Edge cases:

- Added while filtered → if search doesn't match, hidden until cleared.

Status: `[ ]`

### ADM-USERS-22 — Edited user updates persist in table

Expected: After Save Changes, invalidateAdmin → refetch. Updated email visible.

Status: `[ ]`

### ADM-USERS-23 — Deleted user removed from table

Expected: deleteUserMut → trpc.admin.deleteUser. invalidateAdmin → refetch. Row removed.

Status: `[ ]`

### ADM-USERS-24 — Role change visible after mutation completes

Expected: Role badge updates to new role with appropriate styling (admin: fef3c7 bg, amber-900; director: dbeafe bg, 1e3a8a text).

Status: `[ ]`

## Admin Panel Access Control

### ADM-USERS-25 — Non-admin user cannot access users tab

**Role:** lead/viewer (non-admin)

Steps:

1. Log in as lead.
2. Navigate to `/admin?tab=users`.

Expected: Access denied. Redirected. adminProcedure guard (admin or head).
Edge cases:

- Head → allowed.
- Viewer → denied.

Status: `[ ]`
