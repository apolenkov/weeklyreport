## ADDED Requirements

### Requirement: Mobile Admin operational alerts explain their counts

The compact navigation in `AdminTabsMobileSelect` MUST visibly describe a
nonzero pending Reopen count as "1 pending reopen request" or "N pending
reopen requests". Failed-job alerts MUST likewise state what their number
counts. Each alert MUST retain its existing destination and accessible name
without a detached duplicate count badge. Zero MUST NOT be presented as a
pending alert, and a failed count query MUST remain distinguishable from zero.

#### Scenario: A Reopen request is pending

- **WHEN** the compact Admin navigation has one or more pending Reopen requests
- **THEN** its visible alert states the count and what is pending with correct singular or plural wording
- **AND** activating it uses the existing Reopen destination

#### Scenario: A count is unavailable

- **WHEN** a compact-navigation count query fails
- **THEN** the alert exposes the unavailable state rather than a fabricated zero

### Requirement: Mobile Admin records retain identity and actions

The Users and Periods surfaces at `/admin?tab=users` and `/admin?tab=periods`
MUST keep record identity, role or period state, and existing row actions
reachable at 375 CSS pixels without clipped meaningful text or document-level
horizontal overflow. Names and long email addresses MUST wrap. The Periods
surface MUST expose the week/date range and existing submission progress.
Any remaining internal horizontal overflow MUST have a visible scroll cue.
Desktop tables MAY retain their existing columns. Responsive presentations
MUST reuse existing action behavior and MUST NOT duplicate accessible DOM IDs.

#### Scenario: An Admin reads mobile Users and Periods

- **WHEN** the Admin opens Users or Periods at 375 CSS pixels
- **THEN** each record's identity and state are readable and its available actions remain reachable
- **AND** moving to 1440 CSS pixels preserves the desktop table information

### Requirement: AI secondary tabs fit the mobile Admin surface

Provider and Features tabs at `/admin?tab=ai` MUST show their complete labels
and readiness counts at 375 CSS pixels. Labels and counts MAY stack within
the existing tab control, while the desktop inline presentation MAY remain.
The shared tab state, deep links, and provider testing and activation gates
MUST remain unchanged.

#### Scenario: An Admin reads AI tab readiness on mobile

- **WHEN** the Admin opens AI at 375 CSS pixels
- **THEN** both tab names and readiness counts are visible without clipping
- **AND** selecting either tab keeps the existing active-panel and deep-link behavior
