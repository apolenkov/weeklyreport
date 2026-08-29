## ADDED Requirements

### Requirement: Remaining compact-viewport actions meet the touch floor

Below 48 rem, each segment of the report view-mode toggle, the development-only
role-switcher trigger, and every admin-user row action in the corresponding
`apps/web` React surfaces MUST render at least 44 by 44 CSS pixels. Labels,
selected state, navigation, dropdown behavior, and compact desktop geometry
MUST remain unchanged.

#### Scenario: Lead changes report view on a phone

- **WHEN** Edit and Slides segments are visible below 48 rem
- **THEN** each interactive segment measures at least 44 by 44 CSS pixels
  without root overflow

#### Scenario: Administrator uses user-row actions on a phone

- **WHEN** Edit, Activate or Deactivate, and More actions are visible below 48
  rem
- **THEN** every action measures at least 44 by 44 CSS pixels while the
  intentionally scrollable table stays contained

#### Scenario: Dev role switcher is enabled

- **WHEN** the development-only role switcher appears below 48 rem
- **THEN** its trigger measures at least 44 by 44 CSS pixels and preserves its
  menu semantics
