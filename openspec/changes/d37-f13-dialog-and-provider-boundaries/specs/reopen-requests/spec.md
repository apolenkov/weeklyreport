## MODIFIED Requirements

### Requirement: Later-page failures preserve reachable reopen-request rows

If a later reopen-request page fails, both UI surfaces MUST retain all rows from
earlier successful pages, identify that the loaded list is partial, and offer a
Retry action for the failed page. Retrying MUST append the recovered page rather
than replacing prior rows.

#### Scenario: Admin later-page request fails and recovers

- **GIVEN** the admin tab has loaded at least one page with another cursor
- **WHEN** Load more fails and the admin retries successfully
- **THEN** the prior rows remain visible throughout
- **AND** the recovered rows append to them

#### Scenario: Dashboard later-page request fails and recovers

- **GIVEN** the head dashboard queue has loaded at least one page with another cursor
- **WHEN** Load more fails and the head retries successfully
- **THEN** the prior rows remain visible throughout
- **AND** the recovered rows append to them

#### Scenario: Background refresh preserves response focus

- **WHEN** a background refresh fails while a response field holds focus
- **THEN** Retry remains reachable without taking focus; user-requested Load more failure retains its Retry autofocus
