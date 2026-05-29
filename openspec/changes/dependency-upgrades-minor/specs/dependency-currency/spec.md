# Dependency Currency

## ADDED Requirements

### Requirement: Minor And Patch Upgrades Land As A Single Gated Batch

Minor and patch dependency upgrades MUST be applied as one batch and validated
by a single full gate pass (`pnpm typecheck && pnpm lint && pnpm test`), rather
than gated per-package. Major-version upgrades MUST NOT ride along in this batch.

#### Scenario: A batch of minor/patch bumps is validated

- **WHEN** all minor/patch dependency bumps from the audit are applied together
- **THEN** the full gate suite is run exactly once over the whole batch
- **AND** the batch is accepted only if `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0

#### Scenario: A major-version bump is attempted in the batch

- **WHEN** a major-version upgrade (e.g. `lucide-react` 0.x -> 1.x, `typescript` 5 -> 6) is proposed for inclusion
- **THEN** it is rejected from the minor/patch batch
- **AND** it is deferred to its own isolated change so any failure stays contained

### Requirement: Coupled Packages MUST Move In Lockstep

Packages that share a runtime adapter, instrumentation version, or plugin contract MUST be upgraded together to the same target version within a batch, so no partial-bump version skew is introduced.

#### Scenario: Sentry instrumentation packages are bumped

- **WHEN** any of `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/node` is bumped
- **THEN** all three are bumped to the same target version (10.55.0) in the same batch

#### Scenario: The typescript-eslint trio is bumped

- **WHEN** any of `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `typescript-eslint` is bumped
- **THEN** all three are bumped to the same target version (8.60.0) so `eslint.config.ts` resolves a single coherent version
- **AND** the lint gate exits 0 against the new version

#### Scenario: The NestJS core trio is bumped

- **WHEN** any of `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` is bumped
- **THEN** all three are bumped to the same target version (11.1.24) in the same batch

#### Scenario: The commitlint pair is bumped

- **WHEN** either `@commitlint/cli` or `@commitlint/config-conventional` is bumped
- **THEN** both are bumped to the same target version (21.0.2) in the same batch

### Requirement: Pre-1.0 Dependencies MUST Be Verified Against Their Consumer

A dependency below version 1.0 MUST be verified against its direct consumer surface before the batch is accepted, because such a release MAY introduce breaking changes even when the registry reports it as minor/patch.

#### Scenario: The Anthropic SDK is bumped

- **WHEN** `@anthropic-ai/sdk` is bumped from 0.98.0 to 0.100.1
- **THEN** the AI-module facade under `apps/api/src/modules/ai/` is confirmed to compile
- **AND** the AI-module tests, including `golden-set.eval.test.ts`, stay green
