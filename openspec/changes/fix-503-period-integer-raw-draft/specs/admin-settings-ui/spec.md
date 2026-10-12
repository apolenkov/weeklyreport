## ADDED Requirements

### Requirement: Period policy integer fields validate the raw draft without browser sanitization

The Settings → Periods integer fields (period length, default deadline days,
grace period hours, auto-archive weeks and reopen window hours) SHALL validate
the admin's draft text only with the field's integer parser. The browser
control SHALL NOT sanitize, normalize or step the text while it is being
edited. Invalid draft text SHALL remain visible exactly as entered, with its
inline bounds error, and Save SHALL stay disabled until every active field
holds a whole number within bounds. A valid draft MAY be re-rendered in
canonical integer form after it commits. Each field SHALL state its accepted
range in its accessible description.

#### Scenario: A non-numeric draft stays visible

- **WHEN** an admin types `12days` into Reopen window (hours) while reopen is allowed
- **THEN** the field shows `12days`
- **AND** the inline error reads `Whole number between 0 and 168 required`
- **AND** Save period policy is disabled

#### Scenario: A parser-accepted sign commits

- **WHEN** an admin types `+8` into Period length (days) with a saved value of 7
- **THEN** the draft commits 8 with no error

#### Scenario: The range is announced

- **WHEN** an assistive technology reads Period length (days)
- **THEN** its accessible description includes `Must be 1..31 days`
