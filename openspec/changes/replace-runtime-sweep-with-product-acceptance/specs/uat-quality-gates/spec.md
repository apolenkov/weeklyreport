## MODIFIED Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Bounded Product Chain

Before WeeklyReport is described as release-ready, the repository MUST pass `pnpm typecheck`, `pnpm lint`, `pnpm test`, an explicitly configured production `pnpm build`, and focused product-adjacent tests required by the changed release surface. It MUST NOT require a root browser, E2E, UAT, catalog, acceptance, or integration harness.

#### Scenario: The complete final gate is green

- **WHEN** the required product commands run at one exact Git SHA
- **THEN** every selected command exits zero
- **AND** no deleted harness command is part of the gate

#### Scenario: A final gate command fails

- **WHEN** a required product command fails
- **THEN** final acceptance fails without adding an unrelated test platform

### Requirement: Final acceptance MUST NOT depend on exhaustive runtime campaigns

The final WeeklyReport verdict MUST NOT require a browser harness, route matrix, scenario catalog, UAT inventory, interaction graph, campaign manifest, continuation chunks, custom supervisor, custom acceptance receipt, AI-import verdict, or multi-hour canary.

#### Scenario: Bounded acceptance is complete

- **WHEN** deterministic code gates and relevant product-adjacent tests pass at one source SHA
- **THEN** acceptance is complete without any retired browser or campaign command

## REMOVED Requirements

### Requirement: All Four Roles MUST Pass UAT With Zero Console Errors

**Reason**: The four-role UAT matrix is retired.

**Migration**: Canonical role boundaries remain enforced in product code and focused tests.

### Requirement: Integration Test Global Setup MUST Resolve The Repo Root Robustly

**Reason**: The root integration harness and global setup are deleted.

**Migration**: Product-adjacent database tests own their local setup.

### Requirement: The mutation-consumer audit MUST report the size of the set it examined

**Reason**: The UAT static-analysis subsystem is deleted.

**Migration**: Product mutations own explicit cache/read-back logic and focused tests.

### Requirement: A mutation counts as read back only on evidence, never on resemblance

**Reason**: The UAT static-analysis subsystem is deleted.

**Migration**: Verify read-back in the owning product test.

### Requirement: The audit MUST NOT write to the tree in gate mode

**Reason**: The audit and generated report are deleted.

**Migration**: No replacement generated audit is introduced.

### Requirement: Browser business assertions MUST survive unrelated seed growth

**Reason**: The root browser integration scenarios are deleted.

**Migration**: Product-adjacent tests derive preconditions within their owning module.

### Requirement: Four-role UAT MUST contain zero axe violations

**Reason**: The route and axe matrix is retired.

**Migration**: Accessibility remains a product requirement verified in focused UI tests and review.

### Requirement: The axe gate MUST prove that it examines a real defect

**Reason**: The dedicated browser axe gate is deleted.

**Migration**: Focused accessibility tests must remain capable of failing for the defect they claim.
