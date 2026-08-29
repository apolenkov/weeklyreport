# repository-security-controls Specification

## Purpose

Defines repository-level security controls that keep automated checks
least-privileged, make sensitive-path ownership explicit, and preserve a tested
private vulnerability-response path.

## Requirements

### Requirement: Read-only workflows MUST declare least privilege

Every checked-in GitHub Actions workflow MUST declare `contents: read` as its
default permission and MUST NOT inherit a broader repository token implicitly.
Any job that needs an elevated permission MUST declare only that permission at
job scope and MUST document the trusted operation that requires it.

#### Scenario: A read-only workflow is inspected

- **WHEN** any workflow under `.github/workflows/` is parsed
- **THEN** its effective declared baseline is `contents: read`
- **AND** it declares no write permission for a read-only quality, test, audit,
  or build operation

#### Scenario: A future publishing job needs authority

- **WHEN** a future job publishes a package, attestation, security result, or
  deployment
- **THEN** only that job declares the exact required write scope
- **AND** ordinary pull-request jobs remain read-only

### Requirement: Read-only checkouts MUST NOT retain credentials

Every `actions/checkout` step in a job that does not push repository changes
MUST disable credential persistence. A future write-back checkout MUST be
isolated to a trusted event and MUST document why retained credentials are
necessary.

#### Scenario: Current workflows check out source

- **WHEN** the CI or dependency-scan workflow checks out the repository
- **THEN** the checkout has credential persistence disabled
- **AND** later untrusted build or test steps cannot recover a repository token
  from the checkout Git configuration

### Requirement: Sensitive repository paths MUST have explicit ownership

The repository MUST declare an owner for the ownership policy itself, GitHub
workflow configuration, Prisma schema and migrations, deployment
configuration, security policy, and public shared contracts.

#### Scenario: A sensitive path changes

- **WHEN** a pull request changes a declared sensitive path
- **THEN** GitHub can resolve an explicit code owner for that path
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
