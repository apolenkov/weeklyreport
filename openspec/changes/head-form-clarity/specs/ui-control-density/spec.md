## MODIFIED Requirements

### Requirement: Compact actions meet the touch target

Below 48 rem, report view-mode segments, the development role-switcher trigger
and menu items, and admin user-row actions MUST each measure at least 44 by 44
CSS pixels. The shared segmented-toggle track MUST preserve child focus
indicators and its compact desktop geometry. Head Report / Slides segments
MUST retain this geometry independently of their labels.

#### Scenario: a phone user changes report view

- **WHEN** Report and Slides segments are visible below 48 rem
- **THEN** each segment is at least 44 by 44 CSS pixels without root overflow

#### Scenario: a phone user operates a user row

- **WHEN** user-row actions are visible below 48 rem
- **THEN** every action is at least 44 by 44 CSS pixels
