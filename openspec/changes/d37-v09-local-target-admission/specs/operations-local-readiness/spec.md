## ADDED Requirements

### Requirement: Public local dependency scripts enforce the declared target

`pnpm deps:up` and `pnpm deps:down` MUST admit only the declared OrbStack context `orbstack` before their first Kubernetes operation and MUST pin each operation to that context. The scripts MUST retain namespace `wr-dev`, existing manifests and down's PVC preservation semantics. An unknown context or failed context lookup MUST stop the command before any create, apply, rollout or delete operation.

#### Scenario: Ambient context belongs to a shared cluster

- **WHEN** a local dependency command starts with a context other than `orbstack`
- **THEN** it exits non-zero before any resource operation

#### Scenario: The local context is admitted

- **WHEN** the active context is `orbstack`
- **THEN** every dependency operation explicitly selects that context
- **AND** the existing namespace and manifest operations remain unchanged

### Requirement: Standalone tester stop enforces shared target admission

`deploy/tester-kit/stop.sh` MUST apply the same local context and namespace admission as guarded tester writes before accessing or deleting resources. Supported contexts remain `orbstack` and `docker-desktop`; namespaces remain `wr-tester` or `wr-tester-*`. Stop MUST pin its resource calls to that admitted context and MUST NOT require a live API pod for target admission.

#### Scenario: Stop receives an unsafe target

- **WHEN** stop receives another context or namespace
- **THEN** it fails before namespace access or deletion

#### Scenario: A supported second stand is stopped

- **WHEN** stop receives a supported local context and `wr-tester-2`
- **THEN** target admission succeeds without executing an API pod command
- **AND** all namespace resource operations explicitly select that context
