## ADDED Requirements

### Requirement: Session resume-hint writes follow the existing dev-auth predicate

Authenticated SessionProvider MUST write the personal last-role resume hint only when webEnv.authStub is true. Production MUST produce no new hint writes even if the public stub toggle is true. Development with the stub disabled MUST also produce no new hint writes. Enabled development MUST preserve its current resume behavior, including retaining the hint when the session later becomes anonymous. This change MUST NOT add TTL, logout cleanup, storage migration or deletion of previously stored records.

#### Scenario: Production resolves an authenticated session

- **WHEN** auth.me resolves an authenticated session in production with either public stub flag value
- **THEN** SessionProvider maps and exposes that session normally
- **AND** it writes no personal last-role hint to localStorage

#### Scenario: Development disables the auth stub

- **WHEN** development resolves an authenticated session with the auth stub disabled
- **THEN** SessionProvider writes no last-role resume hint

#### Scenario: Enabled development retains its resume hint

- **GIVEN** development enables the auth stub and resolves an authenticated session
- **WHEN** auth.me later resolves null
- **THEN** the established dev hint remains available for the landing resume control
- **AND** session mapping remains anonymous
