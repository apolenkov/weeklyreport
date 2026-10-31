## ADDED Requirements

### Requirement: Role-gated alert actions show a placeholder while the session loads

While `auth.me` has not answered, a role-gated action in the Dashboard alert bar
MUST render a visible loading placeholder instead of nothing. After `auth.me`
settles the placeholder MUST be replaced by the action (allowed role) or by
nothing (other roles).

#### Scenario: Admin opens the Dashboard while auth.me is slow

- **GIVEN** the alert bar shows pending leads with no active reminder rule
- **WHEN** `auth.me` has not responded yet
- **THEN** a "Checking reminder settings…" status is visible where "Configure reminders" will appear
- **AND** when `auth.me` returns the admin role the status is replaced by the "Configure reminders" link

#### Scenario: Non-admin sees no leftover placeholder

- **WHEN** `auth.me` returns the head or lead role
- **THEN** neither the link nor the placeholder is rendered
