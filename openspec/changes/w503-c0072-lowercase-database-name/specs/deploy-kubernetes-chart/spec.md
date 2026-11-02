## ADDED Requirements

### Requirement: The chart MUST accept only lower-case database names

The chart's `values.schema.json` MUST accept `postgres.db` only when it matches
`^[a-z0-9_]+$`, because `deploy/postgres/restore.sh` canonicalises `PGDATABASE`
to lower case and could not reach a mixed-case database.

#### Scenario: A mixed-case database name is configured

- **WHEN** an operator renders or installs the chart with `postgres.db` set to a name containing an upper-case letter
- **THEN** Helm refuses the values with a schema error that names `/postgres/db`
- **AND** no manifest is rendered

#### Scenario: A lower-case database name is configured

- **WHEN** an operator renders the chart with `postgres.db` set to `weeklyreport_production`
- **THEN** the chart renders
