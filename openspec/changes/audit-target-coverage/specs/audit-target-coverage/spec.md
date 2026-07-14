## ADDED Requirements

### Requirement: Mutation Audit Rows Capture A Target For User-Lifecycle And Group-Product Edge Mutations

`mutationAuditMiddleware`'s target extraction (`TARGET_ID_KEYS`) MUST
include `userId` and `groupId` (in addition to the existing
`sectionId`/`reportId`/`periodId`/`projectId`/`leadId`/`id` keys), so that a
mutation whose input identifies its subject only by `userId` or `groupId`
still produces an audit row with a resolved `target`.

#### Scenario: User-lifecycle mutations carry a target

- **WHEN** `admin.deactivateUser`, `admin.activateUser`, or
  `admin.deleteUser` is called with `{ userId }`
- **THEN** the resulting audit row's `target` equals that `userId`

#### Scenario: Group-product edge mutations carry a target

- **WHEN** `admin.attachProductToGroup` or `admin.detachProductFromGroup` is
  called with `{ groupId, productId }`
- **THEN** the resulting audit row's `target` is non-undefined, resolved to
  one of the mutation's identifying ids

#### Scenario: Existing target resolution is unaffected

- **WHEN** a mutation whose input carries `sectionId`, `reportId`,
  `periodId`, `projectId`, `leadId`, or bare `id` (and none of the newly
  added keys) is called
- **THEN** its audit row's `target` resolves exactly as it did before this
  change
