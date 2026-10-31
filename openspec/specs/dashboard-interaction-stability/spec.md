# dashboard-interaction-stability Specification

## Purpose

Keep the desktop Dashboard queue stable while rows disclose details or transition from loading to settled content.

## Requirements

### Requirement: Dashboard queue actions do not shift during disclosure

At desktop width, every Dashboard queue row MUST reserve stable compact tracks for its primary action and Details toggle. Changing `Details` to `Less` MUST NOT move either control horizontally, while the expanded detail content MAY increase only the row height.

#### Scenario: Head expands and collapses a lead row

- **WHEN** the Head toggles a queue row from Details to Less and back
- **THEN** the primary action and disclosure toggle retain their exact horizontal coordinates
- **AND** the disclosure remains keyboard-focusable and linked to its detail region

### Requirement: Dashboard queue skeleton preserves loaded-row geometry

The Dashboard queue skeleton MUST reserve the same desktop action tracks, control height, and summary-row minimum height as the loaded queue.

#### Scenario: Dashboard data finishes loading

- **WHEN** queue skeleton rows are replaced by loaded lead rows
- **THEN** the queue frame and action tracks retain their geometry
- **AND** the transition does not shift adjacent controls because of label width

### Requirement: Dashboard queue action tiers are visually equivalent

At desktop width, Dashboard controls within the same action tier MUST use the same outer height, width, alignment, and reserved geometry. Summary-row primary actions and disclosure controls MUST each fill a `5.5rem` track. Expanded-row actions MUST each fill a `9.25rem` cell and use the shared `44px` action height. Different labels, icons, pending copy, and disclosure state MUST NOT resize an individual control.

#### Scenario: Head compares queue actions in one expanded row

- **WHEN** the Head expands a submitted lead row
- **THEN** `Review` and `Less` fill equal summary-row tracks
- **AND** `Open`, `Request changes`, and `Revoke` use equal expanded-row cells
- **AND** every visible queue action remains vertically centered on the same baseline

#### Scenario: An action changes its visible label

- **WHEN** a disclosure or mutation changes a queue action label
- **THEN** the control retains its exact outer width and height
- **AND** adjacent controls retain their coordinates

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
