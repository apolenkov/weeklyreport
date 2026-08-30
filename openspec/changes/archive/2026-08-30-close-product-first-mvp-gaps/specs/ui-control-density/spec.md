## ADDED Requirements

### Requirement: Remaining compact-viewport actions meet the touch floor

Below 48 rem, each segment of the report view-mode toggle, the development-only
role-switcher trigger and its interactive menu items, and every admin-user row
action in the corresponding `apps/web` React surfaces MUST render at least 44
by 44 CSS pixels. Labels, selected state, navigation, dropdown behavior, and
compact desktop geometry MUST remain unchanged. The shared segmented-toggle
track MUST also have at least the 44 px mobile minimum while retaining its
existing compact desktop height, and MUST NOT clip its child focus indicators.

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
- **THEN** its trigger and every interactive role, reseed, and logout menu item
  measure at least 44 by 44 CSS pixels and preserve their menu semantics
- **AND** its menu remains within the viewport at 280 CSS pixels wide
- **AND** a failed logout or reseed re-enables the trigger before returning
  keyboard focus to it
