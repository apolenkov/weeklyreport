# status-presentation-model Delta

## ADDED Requirements

### Requirement: The canonical status vocabulary is declared once

The system MUST declare the canonical status union
(`"blocked" | "at-risk" | "on-track" | "empty"`) exactly once: `CanonicalStatus` in
`apps/web/src/lib/status-presentation.ts`, next to the canonical map it
keys. Every other name for the vocabulary MUST be a type alias of
`CanonicalStatus` (e.g. `StageStatus` in
`features/report-sections/model/traffic-light.ts` is the feature-domain
alias; `model/mock-data.ts` re-exports that alias), never a re-declared
literal union. Modules outside the feature MUST NOT import the type from a
feature module — `lib` code types against `CanonicalStatus` directly.

#### Scenario: a module needs the canonical status type

- **WHEN** a module in `apps/web/src/lib` needs the vocabulary type
- **THEN** it imports `CanonicalStatus` from `lib/status-presentation`
- **AND** no `lib` module imports the type from a feature module

#### Scenario: a feature-domain name is kept

- **WHEN** feature code refers to the vocabulary as `StageStatus`
- **THEN** that name resolves to a type alias of `CanonicalStatus`
- **AND** no second literal-union declaration of the four values exists
