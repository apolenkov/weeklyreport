# Proposal

## Why

Required text can still consist solely of directional marks, Hangul fillers or variation selectors after TASK-503.104. TASK-503.107 adopts policy A approved by 008: those values must fail new writes while legitimate multilingual text and emoji retain their exact representation.

## What Changes

- **BREAKING**: extend required-content validation on shared write boundaries to the full Unicode `Default_Ignorable_Code_Point` property, including its reserved points, together with ECMAScript whitespace.
- Preserve successful input exactly and retain existing null-byte, length, message and optionality rules.
- Record engine/Unicode versions and compare the effective property sets on engine upgrades.
- Deliver after TASK-503.104 and TASK-503.108 read compatibility, with TASK-503.106's shared classifier handoff first and a separate expanded stored-value clearance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-conventions`: full default-ignorable required-content policy for shared write inputs; versioned classification and byte preservation.

## Impact

Owner: `packages/shared/src/schemas/primitives/report-primitives.schema.ts`; primary tests: `packages/shared/src/schemas/report/report.invisible-text.test.ts`. Existing shared consumers span report prose/stage writes, review, activity, search and assistant inputs. Caller bindings and normative Unicode data are archived in `task-503/invisible-107/` beside the brief. No dependency or database-schema change is proposed.

## Non-goals

- Removing or normalizing characters, rejecting all combining/control characters, or treating reserved non-DICP points as blank.
- Reworking stored read models, client validation ownership, Admin/SAML boundaries, or closing whole C3679/TASK-503.45.
- Unscoped runtime execution or delivery without the separate resource, scan and acceptance gates.
