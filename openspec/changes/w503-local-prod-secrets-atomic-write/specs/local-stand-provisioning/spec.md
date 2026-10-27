# Spec Delta

## ADDED Requirements

### Requirement: Local stand bootstrap never publishes partial secrets

`deploy/local-prod/setup.sh` MUST NOT leave a partially generated `secrets.env`
in the state directory when secret generation is interrupted. A following run
MUST generate every required secret before Kubernetes operations. A generated
`secrets.env` MUST have mode `600`.

#### Scenario: Interrupted generation publishes nothing

- **WHEN** secret generation stops before the complete file is written
- **THEN** the state directory contains no `secrets.env`
- **AND** the next run generates every required key before Kubernetes operations

#### Scenario: A missing secret file is generated completely

- **WHEN** the state directory has no `secrets.env`
- **THEN** setup publishes a `secrets.env` with every required key at mode `600`
- **AND** setup continues to Kubernetes operations

#### Scenario: An existing secret file is reused

- **WHEN** `secrets.env` already exists
- **THEN** setup sources it without rewriting its content
