## ADDED Requirements

### Requirement: Crawler diagnostic failures retain their cause

The crawler MUST allow environment-only secrets only when the file is absent; other read failures MUST retain path and cause without revealing contents. CLI bootstrap MUST obey configured time/output limits. Failed CLI output MUST be recovered only when complete valid batch results are available; invalid output MUST retain the original exit and stderr.

#### Scenario: Secret file exists but cannot be read

- **WHEN** secret-file reading fails for a reason other than absence
- **THEN** configuration reports its path and original cause even if environment credentials exist

#### Scenario: CLI bootstrap stalls or batch output is truncated

- **WHEN** bootstrap exceeds its timeout or failed batch output is incomplete
- **THEN** the original bounded CLI failure remains observable

### Requirement: Login and page retries preserve diagnostic ownership

Crawler login MUST keep four bounded attempts and back off only between attempts. Terminal failure MUST retain the final cause and attempt count without exposing credentials. Quick and full page retries MUST retain distinct page and sign-in failures when all attempts fail, while discarding abandoned findings after a successful retry.

#### Scenario: All four login attempts fail

- **WHEN** authentication fails four times
- **THEN** exactly three backoffs occur and the final cause remains attached

#### Scenario: Page retry cannot sign in

- **WHEN** page loading and secondary sign-in both fail
- **THEN** both failures are distinguishable in the terminal diagnostic

### Requirement: Log draining clears only confirmed observations

The crawler MUST read each log source before clearing it. A failed read MUST remain explicit and its source MUST NOT be cleared. Successfully read sources MUST remain reportable even when another source fails. Clear failures MUST be reported after delivering read evidence.

#### Scenario: A log read or clear fails

- **WHEN** one source cannot be read or cleared
- **THEN** its failure is reported and other successfully read evidence is preserved
- **AND** unread sources remain uncleared
