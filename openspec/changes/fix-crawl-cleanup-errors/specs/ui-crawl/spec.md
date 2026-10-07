## ADDED Requirements

### Requirement: Role cleanup preserves failures

The crawler MUST attempt profile persistence and browser shutdown independently. Every crawl and cleanup failure MUST remain observable. Failed shutdown MUST identify its browser session and preserve its cause. An otherwise successful crawl with failed cleanup MUST exit unsuccessfully.

#### Scenario: Profile persistence fails

- **WHEN** writing the role profile fails
- **THEN** browser shutdown is still attempted
- **AND** the write failure remains observable

#### Scenario: Crawl and cleanup both fail

- **WHEN** traversal, profile persistence and browser shutdown fail
- **THEN** all three failures remain observable
- **AND** the crawl does not report success

#### Scenario: Shutdown fails after successful traversal

- **WHEN** traversal succeeds but browser shutdown fails
- **THEN** the role exits unsuccessfully with the session and shutdown cause
