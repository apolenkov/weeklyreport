## ADDED Requirements

### Requirement: Requested quick-walk reset preserves both outcomes

`deploy/tester-kit/walk.sh --quick --reset` MUST attempt its existing guarded reset entrypoint after the crawler returns, even when the crawler fails. A crawler failure MUST remain the primary exit status; a reset failure MUST be reported independently and MUST make an otherwise successful crawl exit non-zero. A quick run without --reset MUST NOT introduce a reset attempt.

#### Scenario: Quick crawler fails and reset succeeds

- **WHEN** a quick crawl exits non-zero and --reset was requested
- **THEN** the reset entrypoint is attempted
- **AND** the original crawler exit remains the final status

#### Scenario: Both quick crawl and reset fail

- **WHEN** both commands exit non-zero after --reset was requested
- **THEN** reset failure is independently reported
- **AND** the original crawler exit remains the final status

#### Scenario: Only reset fails

- **WHEN** the crawler succeeds and the requested reset fails
- **THEN** the reset failure is reported and the runner exits non-zero

#### Scenario: Quick reset is not requested

- **WHEN** a quick crawl returns without --reset
- **THEN** its exit is preserved and no reset is attempted
