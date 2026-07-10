## ADDED Requirements

### Requirement: The traffic-light status type has one source of truth

The workspace MUST expose exactly one traffic-light status contract: the
`trafficLightStatusSchema` Zod enum and its inferred `TrafficLightStatus`
type, exported from `packages/shared`. The `"green" | "yellow" | "red"`
literal union MUST NOT be re-declared anywhere else in the workspace;
consumers MUST import the shared type and MAY compose it (`| null`,
`| "empty"`, `Record<TrafficLightStatus, …>`) or take deliberate subsets.

#### Scenario: consumers import instead of re-declaring

- **WHEN** an api or web module needs the traffic-light status type
- **THEN** it imports `TrafficLightStatus` from `@customreport/shared`
- **AND** no module outside `report-primitives.schema.ts` declares the full
  three-literal union

#### Scenario: composition preserves local semantics

- **WHEN** a site needs "no data" or a presentation-only extra state
- **THEN** it composes the shared type (`TrafficLightStatus | null`,
  `TrafficLightStatus | "empty"`) rather than re-declaring members

### Requirement: The shared contract matches the database enum

The shared `TrafficLightStatus` type MUST stay value-identical to the Prisma
`TrafficLightStatus` enum, and the schema MUST accept exactly the three
canonical values.

#### Scenario: the schema pins its members

- **WHEN** `trafficLightStatusSchema` parses input
- **THEN** it accepts exactly `green`, `yellow`, and `red` and rejects any
  other string

#### Scenario: drift against the database enum fails the build

- **WHEN** either the shared type or the Prisma enum changes members
- **THEN** the type-identity test in the api package fails

### Requirement: Analytics reuses the shared schema

The analytics traffic-light cell schema MUST derive from
`trafficLightStatusSchema` (with `.nullable()` for empty cells) rather than
declaring its own enum.

#### Scenario: one enum inside the shared package

- **WHEN** the shared package's schemas mention traffic-light values
- **THEN** only `report-primitives.schema.ts` carries the literal members
