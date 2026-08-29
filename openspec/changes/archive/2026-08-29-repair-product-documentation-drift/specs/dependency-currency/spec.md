## MODIFIED Requirements

### Requirement: Pre-1.0 Dependencies MUST Be Verified Against Their Consumer

A dependency below version 1.0 MUST be verified against every maintained direct
consumer surface before an upgrade batch is accepted, because a minor or patch
release MAY introduce breaking changes. A dependency and consumer that are absent
from the maintained product and retained only in an explicit deferred activation
record MUST NOT be treated as a current upgrade target; its consumer verification
contract MUST be established by the activation change before the dependency is
added.

#### Scenario: A maintained pre-1.0 dependency is bumped

- **WHEN** a dependency below version 1.0 changes version in a delivery batch
- **THEN** every maintained direct consumer compiles against the new version
- **AND** focused consumer tests and the applicable repository gates pass

#### Scenario: The Anthropic SDK is bumped

- **WHEN** the deferred AI capability is explicitly activated and adds or bumps `@anthropic-ai/sdk`
- **THEN** the activation change provides a maintained AI-module facade that compiles against the selected version
- **AND** focused AI-module contract tests pass before the dependency enters the maintained product

#### Scenario: A deferred dependency is absent from the product

- **WHEN** a deferred capability names a future pre-1.0 dependency that is absent from the package manifests and maintained source
- **THEN** the current dependency-currency gate does not require a nonexistent consumer
- **AND** the future activation change must add focused consumer verification before adding the dependency
