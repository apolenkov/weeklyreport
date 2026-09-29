# repository-security-controls Specification

## Purpose

Defines repository-level security controls that keep automated checks
least-privileged, make sensitive-path ownership explicit, and preserve a tested
private vulnerability-response path.

## Requirements

### Requirement: Sensitive repository paths MUST have explicit ownership

The repository MUST declare an owner in `.gitlab/CODEOWNERS` for the ownership policy itself, the security policy, Prisma schema and migrations, deployment configuration, and public shared contracts.

#### Scenario: A sensitive path changes

- **WHEN** a merge request changes a declared sensitive path
- **THEN** GitLab can resolve an explicit code owner for that path
- **AND** the ownership policy file is itself owned

### Requirement: Private vulnerability reporting MUST be documented

The repository MUST provide a checked-in security policy that directs reporters
to a private channel, forbids public disclosure of suspected secrets or active
exploits, and defines the first response sequence for leaked credentials and
CI/CD compromise.

#### Scenario: A credential leak is reported

- **WHEN** a maintainer confirms that a credential may be exposed
- **THEN** the policy requires provider-side revocation or rotation before Git
  history cleanup
- **AND** it requires evidence preservation and an impact review
