# audit-target-coverage Specification

## Purpose

Requires mutation audit rows to capture a target for user-lifecycle and group-product edge mutations, closing gaps in TARGET_ID_KEYS coverage.

## Requirements

### Requirement: Mutation Audit Rows Capture A Target For User-Lifecycle And Group-Product Edge Mutations

`mutationAuditMiddleware`'s target extraction (`TARGET_ID_KEYS`) MUST include
`userId` and `groupId`, so that a
mutation whose input identifies its subject only by `userId` or `groupId`
still produces an audit row with a resolved `target`. Resolution follows the
current ordered key list; `productId` precedes `groupId` for edge mutations.

#### Scenario: User-lifecycle mutations carry a target

- **WHEN** `admin.deactivateUser`, `admin.activateUser`, or
  `admin.deleteUser` is called with `{ userId }`
- **THEN** the resulting audit row's `target` equals that `userId`

#### Scenario: Group-product edge mutations carry a target

- **WHEN** `admin.attachProductToGroup` or `admin.detachProductFromGroup` is
  called with `{ groupId, productId }`
- **THEN** the resulting audit row's `target` is non-undefined, resolved to
  one of the mutation's identifying ids

#### Scenario: Current target precedence remains deterministic

- **WHEN** a mutation whose input carries `sectionId`, `reportId`,
  `periodId`, `projectId`, `leadId`, or bare `id` (and none of the newly
  added keys) is called
- **THEN** its audit row's `target` follows the current ordered key list

### Requirement: Mutation audit target extraction is bounded

Target extraction MUST read at most 8 levels of nesting below the decoded input (an object nested 8 levels down is read, one at 9 is not), MUST visit each object once, and MUST report at most 20 distinct identities in `targets`. When any identity or branch is left out, the audit event MUST carry `truncated: true`. The primary `target` MUST stay the first identity in discovery order, and the durable audit row MUST be unchanged.

#### Scenario: more identities than the cap

- **WHEN** a mutation input names 25 distinct identities
- **THEN** the audit event lists the first 20 in discovery order, `target` is the first, and `truncated` is true

#### Scenario: input within the limits

- **WHEN** a mutation input names 3 identities within 8 levels
- **THEN** the audit event lists all 3 and carries no `truncated` field

#### Scenario: identity at the depth boundary

- **WHEN** an identity sits 8 levels below the input, and another sits 9 levels below
- **THEN** the first is listed and the audit event carries no `truncated` field; the second is not listed and `truncated` is true

#### Scenario: self-referencing input

- **WHEN** the decoded input refers back to one of its own objects
- **THEN** extraction completes, the mutation outcome is preserved, and each object is read once

### Requirement: Mutation log shapes are bounded

The structured mutation log entry MUST describe the decoded input by keys and lengths only, MUST descend at most 5 levels, MUST list at most 50 keys per object, and MUST mark a cut with `…`, a repeated object with `[circular]`, and omitted keys with `+N more`. It MUST NOT contain input values.

#### Scenario: oversized input shape

- **WHEN** a decoded input holds an object with 60 keys nested 7 levels deep
- **THEN** the log lists at most 50 keys per object, descends at most 5 levels, marks omissions, and contains no input values
